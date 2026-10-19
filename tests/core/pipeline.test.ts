import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AnalysisInput } from '../../src/core/model';
import { MAX_BUCKETS } from '../../src/core/buckets';
import { analyze, toAnalysisResult } from '../../src/core/pipeline';
import { serializeCanonicalJson } from '../../src/core/serialization';

type FixtureId = 'checkout-outage' | 'slow-burn' | 'ambiguous';

function fixtureText(fixtureId: FixtureId, fileName: 'logs.jsonl' | 'history.json'): string {
  return readFileSync(new URL(`../../fixtures/incidents/${fixtureId}/${fileName}`, import.meta.url), 'utf8');
}

function fixtureInput(fixtureId: FixtureId): AnalysisInput {
  return {
    logs: { text: fixtureText(fixtureId, 'logs.jsonl'), format: 'jsonl', source: `fixtures/incidents/${fixtureId}/logs.jsonl` },
    history: { text: fixtureText(fixtureId, 'history.json'), format: 'culprit-json', source: `fixtures/incidents/${fixtureId}/history.json` },
    options: null,
  };
}

function historyText(commitTimestamp = '2026-10-19T07:00:00Z'): string {
  return JSON.stringify({
    schemaVersion: 1,
    format: 'culprit-json',
    repository: 'test-service',
    commits: [{
      sha: 'a'.repeat(40),
      author: 'Test Author',
      timestamp: commitTimestamp,
      message: 'test change',
      files: [{ path: 'src/test.ts', added: 3, deleted: 1, ranges: [{ start: 1, end: 5 }] }],
    }],
  });
}

function plainInput(text: string, options: AnalysisInput['options'] = null, commitTimestamp?: string): AnalysisInput {
  return { logs: { text, format: 'plain-text' }, history: { text: historyText(commitTimestamp), format: 'culprit-json' }, options };
}

const THREE_ERRORS = [
  '2026-10-19T07:00:00Z error request failed',
  '2026-10-19T07:05:00Z error request failed',
  '2026-10-19T07:10:00Z error request failed',
].join('\n');

function twoErrors(first: string, second: string): string {
  return `${first} error request failed\n${second} error request failed`;
}

describe('pure analysis pipeline', () => {
  it.each([
    ['checkout-outage', 'spike'],
    ['slow-burn', 'ramp'],
    ['ambiguous', 'ambiguous'],
  ] as const)('composes the complete stream for %s', (fixtureId, expectedClass) => {
    const outcome = analyze(fixtureInput(fixtureId));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;

    expect(outcome.stream.schemaVersion).toBe(1);
    expect(outcome.stream.analysisVersion).toBe('analysis-v1');
    expect(outcome.stream.provenance.eventCount).toBeGreaterThan(0);
    expect(outcome.stream.provenance.commitCount).toBe(3);
    expect(outcome.stream.normalizedEvents.every((event) => event.timestampUtc.endsWith('Z'))).toBe(true);
    expect(outcome.stream.commits.every((commit) => commit.timestampUtc.endsWith('Z'))).toBe(true);
    expect(outcome.stream.errors.length).toBeGreaterThan(0);
    expect(outcome.stream.buckets.length).toBeGreaterThan(0);
    expect(outcome.stream.buckets.every((bucket) => bucket.commitShas.length === 0)).toBe(true);
    expect(outcome.stream.timeline.every((point) => point.commitShas.length === 0)).toBe(true);
    expect(outcome.stream.onset.classification).toBe(expectedClass);
    expect(outcome.stream.diagnostics).toEqual([]);
    expect(outcome.stream.assumptions.join(' ')).toContain('UTC');
  });

  it('retains multiline application/vendor stacks and normalized history evidence', () => {
    const outcome = analyze(fixtureInput('checkout-outage'));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const event = outcome.stream.normalizedEvents.find((candidate) => candidate.level === 'error');
    expect(event?.stack).toContain('vendorRetry');
    expect(event?.stackFrames.find((frame) => frame.vendor)?.filePath).toBe('node_modules/vendor-lib/retry.js');
    expect(event?.stackFrames.find((frame) => !frame.vendor)?.filePath).toBe('src/checkout/payment.ts');
    const paymentFile = outcome.stream.commits[1]?.files.find((file) => file.path === 'src/checkout/payment.ts');
    expect(paymentFile?.path).toBe('src/checkout/payment.ts');
    expect(paymentFile?.ranges).toEqual([{ start: 104, end: 126 }]);
  });

  it('supports plain text through the same orchestration path', () => {
    const outcome = analyze(plainInput([
      '2026-10-19T07:00:00Z error request failed',
      '    at run (src/test.ts:3:2)',
      '2026-10-19T07:05:00+00:00 error request failed',
      '2026-10-19T07:10:00Z error request failed',
    ].join('\n')));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.stream.provenance.logFormat).toBe('plain-text');
    expect(outcome.stream.normalizedEvents[0]?.stack).toContain('at run');
    expect(outcome.stream.onset.classification).toBe('none');
  });

  it('returns recoverable typed outcomes for empty, unsupported, malformed, and limited input', () => {
    const history = fixtureText('checkout-outage', 'history.json');
    const empty = analyze({ logs: { text: ' ', format: 'jsonl' }, history: { text: history, format: 'culprit-json' }, options: null });
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.error.code).toBe('EMPTY_INPUT');

    const unsupported = analyze({ logs: { text: '{}', format: 'jsonl' }, history: { text: history, format: 'git-log' }, options: null });
    expect(unsupported.ok).toBe(false);
    if (!unsupported.ok) expect(unsupported.error.code).toBe('UNSUPPORTED_FORMAT');

    const malformed = analyze({ logs: { text: '{"timestamp":"2026-10-19T00:00:00Z"}', format: 'jsonl' }, history: { text: history, format: 'culprit-json' }, options: null });
    expect(malformed.ok).toBe(false);
    if (!malformed.ok) expect(malformed.diagnostics.some((diagnostic) => diagnostic.code === 'MALFORMED_RECORD')).toBe(true);

    const limited = analyze({ logs: { text: fixtureText('checkout-outage', 'logs.jsonl'), format: 'jsonl' }, history: { text: history, format: 'culprit-json' }, options: { bucketMinutes: 5, maxLogBytes: 10 } });
    expect(limited.ok).toBe(false);
    if (!limited.ok) expect(limited.error.code).toBe('INPUT_LIMIT');
  });

  it('ranks the checkout culprit first through analyze, toAnalysisResult, and canonical JSON without mutating the stream', () => {
    const outcome = analyze(fixtureInput('checkout-outage'));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const before = JSON.stringify(outcome.stream);
    const result = toAnalysisResult(outcome.stream);

    expect(result.suspects.map((suspect) => suspect.sha.slice(0, 7))).toEqual(['2222222', '1111111']);
    const leader = result.suspects[0];
    expect(leader?.rank).toBe(1);
    expect(leader?.score).toBe(0.912065);
    expect(leader?.timeGapMinutes).toBe(12);
    expect(leader?.traceSummary.matchKind).toBe('exact-line');

    expect(result.ranking.status).toBe('ranked');
    expect(result.ranking.referenceUtc).toBe('2026-10-19T04:30:00.000Z');
    expect(result.ranking.eligibleCount).toBe(2);
    const excluded = result.ranking.considered.find((entry) => entry.sha.startsWith('3333333'));
    expect(excluded?.status).toBe('excluded');
    expect(excluded?.reason).toContain('after');

    expect(result.confidence.band).toBe('high');
    expect(result.confidence.labels).toEqual([]);
    expect(result.confidence.scoreSeparation).toBe(0.368012);
    expect(result.incident.interpretation.startsWith('Commit 2222222 is the leading investigation target')).toBe(true);

    const json = serializeCanonicalJson(result);
    expect(json).toContain('"ranking"');
    expect(json).toContain('"labels"');
    expect(serializeCanonicalJson(result)).toBe(json);
    expect(JSON.stringify(outcome.stream)).toBe(before);
  });

  it('assigns commit shas to timeline points with half-open bucket membership', () => {
    const lanes = (commitTimestamp: string): string[][] => {
      const outcome = analyze(plainInput(THREE_ERRORS, null, commitTimestamp));
      expect(outcome.ok).toBe(true);
      if (!outcome.ok) throw new Error('analysis failed');
      expect(outcome.stream.buckets.every((bucket) => bucket.commitShas.length === 0)).toBe(true);
      return toAnalysisResult(outcome.stream).timeline.map((point) => point.commitShas);
    };
    const sha = 'a'.repeat(40);
    expect(lanes('2026-10-19T07:00:00Z')).toEqual([[sha], [], []]);
    expect(lanes('2026-10-19T07:05:00Z')).toEqual([[], [sha], []]);
    expect(lanes('2026-10-19T07:15:00Z')).toEqual([[], [], []]);
  });

  it('accepts exactly the maximum bucket count and returns a typed limit outcome one bucket beyond it', () => {
    const options = { bucketMinutes: 1, maxLogBytes: 1_048_576 };
    const atLimit = analyze(plainInput(twoErrors('2026-10-01T00:00:00Z', '2026-10-07T22:39:00Z'), options));
    expect(atLimit.ok).toBe(true);
    if (atLimit.ok) expect(atLimit.stream.buckets.length).toBe(MAX_BUCKETS);

    const beyond = analyze(plainInput(twoErrors('2026-10-01T00:00:00Z', '2026-10-07T22:40:00Z'), options));
    expect(beyond.ok).toBe(false);
    if (!beyond.ok) {
      expect(beyond.error.code).toBe('INPUT_LIMIT');
      expect(beyond.diagnostics[0]?.code).toBe('INPUT_LIMIT');
      expect(beyond.error.message).toContain(String(MAX_BUCKETS));
    }
  });

  it('returns a typed limit outcome instead of throwing for a two-year timestamp span', () => {
    let outcome: ReturnType<typeof analyze> | undefined;
    expect(() => {
      outcome = analyze(plainInput(twoErrors('2024-10-19T07:00:00Z', '2026-10-19T07:00:00Z')));
    }).not.toThrow();
    expect(outcome?.ok).toBe(false);
    if (outcome !== undefined && !outcome.ok) {
      expect(outcome.error.code).toBe('INPUT_LIMIT');
      expect(outcome.diagnostics[0]?.code).toBe('INPUT_LIMIT');
    }
  });
});
