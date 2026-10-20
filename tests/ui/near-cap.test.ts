import { beforeAll, describe, expect, it } from 'vitest';
import type { AnalysisInput, AnalysisStream } from '../../src/core/model';
import { toAnalysisResult } from '../../src/core/pipeline';
import { serializeCanonicalJson, serializeMarkdown } from '../../src/core/serialization';
import {
  LOG_PAGE_SIZE,
  buildLogPanelView,
  buildSeries,
  buildSignatureRows,
  buildTableTwinRows,
  initialInvestigation,
  investigationContext,
  reduceInvestigation,
} from '../../src/ui/investigation-model';
import { buildPlotGeometry, computeDomain } from '../../src/ui/timeline-geometry';
import { handleAnalyzeRequest } from '../../src/worker/protocol';
import type { AnalyzeResponse } from '../../src/worker/protocol';
import { NEAR_CAP, buildNearCapInput } from '../../scripts/near-cap-input.mjs';

const TIMEOUT = 60_000;
const MAX_LOG_BYTES = 1_048_576;

function inputFor(logText: string, historyText: string): AnalysisInput {
  return {
    logs: { text: logText, format: 'jsonl', source: 'near-cap.jsonl' },
    history: { text: historyText, format: 'culprit-json', source: 'near-cap-history.json' },
    options: null,
  };
}

function analyzeText(logText: string, historyText: string, requestId = 1): AnalyzeResponse {
  return handleAnalyzeRequest({ type: 'analyze', requestId, input: inputFor(logText, historyText) });
}

function streamOf(response: AnalyzeResponse): AnalysisStream {
  if (response.type !== 'result') throw new Error(`expected a result, got ${response.type}`);
  return response.stream;
}

function bytes(text: string): number {
  return Buffer.byteLength(text, 'utf8');
}

function errorLineFor(order: number, offsetMs: number): string {
  const ms = NEAR_CAP.startUtcMs + (NEAR_CAP.baselineBuckets + NEAR_CAP.spikeBuckets - 1) * NEAR_CAP.bucketMs + offsetMs;
  return JSON.stringify({
    timestamp: new Date(ms).toISOString(),
    level: 'error',
    message: `checkout request failed for order ${order}`,
    exception: 'PaymentTimeout',
    stack: `PaymentTimeout: provider did not respond for order ${order}\n    at processPayment (src/checkout/payment.ts:118:9)\n    at vendorRetry (node_modules/vendor-lib/retry.js:10:3)`,
  });
}

function withExtraErrors(logText: string, count: number): string {
  const extra: string[] = [];
  for (let index = 0; index < count; index += 1) extra.push(errorLineFor(900000 + index, 200000 + index * 1000));
  return `${logText}${extra.join('\n')}\n`;
}

/** Lengthen the first record's message by `delta` filler bytes so the total reaches an exact size. */
function padTo(logText: string, targetBytes: number): string {
  const delta = targetBytes - bytes(logText);
  if (delta < 0) throw new Error('log is already larger than the target');
  const lineEnd = logText.indexOf('"}\n');
  return `${logText.slice(0, lineEnd)}${'.'.repeat(delta)}${logText.slice(lineEnd)}`;
}

function refusalCodes(response: AnalyzeResponse): string[] {
  if (response.type !== 'error') throw new Error(`expected a refusal, got ${response.type}`);
  return response.failure.diagnostics.map((entry) => entry.code);
}

describe('near-cap generator', () => {
  it('is deterministic and lands inside the byte and line caps', () => {
    const first = buildNearCapInput();
    const second = buildNearCapInput();
    expect(second.logText).toBe(first.logText);
    expect(second.historyText).toBe(first.historyText);
    expect(second.expected).toEqual(first.expected);
    expect(bytes(first.logText)).toBeGreaterThanOrEqual(1_000_000);
    expect(bytes(first.logText)).toBeLessThanOrEqual(MAX_LOG_BYTES);
    expect(first.logText.split('\n').filter((line) => line !== '')).toHaveLength(9_990);
    expect(bytes(first.historyText)).toBeLessThanOrEqual(1_048_576);
    expect(first.expected.logBytes).toBe(bytes(first.logText));
    expect(first.expected.historyBytes).toBe(bytes(first.historyText));
  }, TIMEOUT);
});

describe('near-cap analysis through the worker handler', () => {
  let input: ReturnType<typeof buildNearCapInput>;
  let response: AnalyzeResponse;
  let stream: AnalysisStream;

  beforeAll(() => {
    input = buildNearCapInput();
    const startedAt = performance.now();
    response = analyzeText(input.logText, input.historyText);
    console.info('METRIC near-cap analyze ms', Math.round(performance.now() - startedAt));
    stream = streamOf(response);
  }, TIMEOUT);

  it('returns a structured-clone-safe result for the planted suspect', () => {
    expect(response.type).toBe('result');
    expect(structuredClone(response)).toEqual(response);
    expect(stream.normalizedEvents).toHaveLength(input.expected.eventCount);
    expect(stream.timeline).toHaveLength(input.expected.bucketCount);
    expect(stream.commits).toHaveLength(input.expected.commitCount);
    expect(stream.ranking.suspects[0]?.sha).toBe(input.expected.leadingSha);
    expect(stream.ranking.considered).toHaveLength(input.expected.commitCount);
  }, TIMEOUT);

  it('gives byte-identical canonical JSON and Markdown across independent analyses', () => {
    const again = streamOf(analyzeText(input.logText, input.historyText, 2));
    const left = toAnalysisResult(stream);
    const right = toAnalysisResult(again);
    expect(serializeCanonicalJson(right)).toBe(serializeCanonicalJson(left));
    expect(serializeMarkdown(right)).toBe(serializeMarkdown(left));
  }, TIMEOUT);

  it('bounds the log lines and the data table to one page of 100 rows', () => {
    const context = investigationContext(stream);
    const signature = stream.errors[0]?.signature;
    if (signature === undefined) throw new Error('expected one error signature');
    let state = initialInvestigation(stream);
    state = reduceInvestigation(state, { type: 'set-filter', signature }, context);
    state = reduceInvestigation(state, { type: 'open-log-lines', scope: 'signature' }, context);
    const logs = buildLogPanelView(stream, state);
    expect(logs.rows).toHaveLength(LOG_PAGE_SIZE);
    expect(logs.total).toBe(290);
    expect(logs.hasMore).toBe(true);
    const table = buildTableTwinRows(stream, state);
    expect(table.rows).toHaveLength(LOG_PAGE_SIZE);
    expect(table.total).toBe(9_729);
    expect(table.hasMore).toBe(true);
  }, TIMEOUT);

  it('draws one series path with exactly one pointer overlay and lists only the generated signatures', () => {
    const domain = computeDomain(
      stream.timeline,
      stream.commits,
      new Set(stream.ranking.considered.filter((row) => row.status !== 'excluded').map((row) => row.sha)),
    );
    if (domain === null) throw new Error('expected a timeline domain');
    const series = buildSeries(stream, null);
    const geometry = buildPlotGeometry(stream.timeline, series.totals, domain, 1000, 200, series.yMax);
    expect(typeof geometry.linePath).toBe('string');
    expect(geometry.overlays).toHaveLength(1);
    const rows = buildSignatureRows(stream, { filter: null });
    expect(rows.rows).toHaveLength(stream.errors.length);
    expect(new Set(rows.rows.map((row) => row.signature))).toEqual(new Set(stream.errors.map((group) => group.signature)));
    expect(rows.rows[0]?.count).toBe(290);
  }, TIMEOUT);
});

describe('near-cap boundaries', () => {
  const base = buildNearCapInput();

  it('accepts exactly 10,000 events and refuses the 10,001st', () => {
    const atCap = analyzeText(withExtraErrors(base.logText, 10), base.historyText);
    expect(atCap.type).toBe('result');
    expect(streamOf(atCap).normalizedEvents).toHaveLength(10_000);
    const overCap = analyzeText(withExtraErrors(base.logText, 11), base.historyText);
    expect(refusalCodes(overCap)).toContain('INPUT_LIMIT');
  }, TIMEOUT);

  it('accepts exactly 1,048,576 bytes of log text and refuses 1,048,577', () => {
    const atCap = padTo(base.logText, MAX_LOG_BYTES);
    expect(bytes(atCap)).toBe(MAX_LOG_BYTES);
    expect(analyzeText(atCap, base.historyText).type).toBe('result');
    const overCap = padTo(base.logText, MAX_LOG_BYTES + 1);
    expect(bytes(overCap)).toBe(MAX_LOG_BYTES + 1);
    expect(refusalCodes(analyzeText(overCap, base.historyText))).toContain('INPUT_LIMIT');
  }, TIMEOUT);

  it('refuses a span of more than 10,000 buckets with a recoverable typed error', () => {
    const lateMs = NEAR_CAP.startUtcMs + (base.expected.bucketCount - 1 + 300) * NEAR_CAP.bucketMs;
    const late = JSON.stringify({ timestamp: new Date(lateMs).toISOString(), level: 'info', message: 'late heartbeat' });
    const response = analyzeText(`${base.logText}${late}\n`, base.historyText);
    expect(response.type).toBe('error');
    if (response.type !== 'error') return;
    expect(response.failure.code).toBe('INPUT_LIMIT');
    expect(response.failure.message).toContain('exceeds the limit of 10000');
  }, TIMEOUT);
});
