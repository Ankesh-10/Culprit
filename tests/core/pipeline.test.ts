import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AnalysisInput } from '../../src/core/model';
import { analyze, toAnalysisResult } from '../../src/core/pipeline';

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

function historyText(): string {
  return JSON.stringify({
    schemaVersion: 1,
    format: 'culprit-json',
    repository: 'test-service',
    commits: [{
      sha: 'a'.repeat(40),
      author: 'Test Author',
      timestamp: '2026-10-19T07:00:00Z',
      message: 'test change',
      files: [{ path: 'src/test.ts', added: 3, deleted: 1, ranges: [{ start: 1, end: 5 }] }],
    }],
  });
}

function plainInput(text: string): AnalysisInput {
  return { logs: { text, format: 'plain-text' }, history: { text: historyText(), format: 'culprit-json' }, options: null };
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

  it('projects a stream without ranking suspects or mutating Phase 2 evidence', () => {
    const outcome = analyze(fixtureInput('checkout-outage'));
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const before = JSON.stringify(outcome.stream);
    const result = toAnalysisResult(outcome.stream);
    expect(result.suspects).toEqual([]);
    expect(result.timeline.every((point) => point.commitShas.length === 0)).toBe(true);
    expect(result.incident.status).toBe('spike');
    expect(JSON.stringify(outcome.stream)).toBe(before);
  });
});
