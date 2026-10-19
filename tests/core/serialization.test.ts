import { describe, expect, it } from 'vitest';
import type { AnalysisResult } from '../../src/core/model';
import { serializeCanonicalJson, serializeMarkdown } from '../../src/core/serialization';

function makeResult(): AnalysisResult {
  return {
    schemaVersion: 1,
    analysisVersion: 'analysis-v1',
    scoringVersion: 'scoring-v1',
    provenance: {
      logSource: 'fixtures/incidents/checkout-outage/logs.jsonl',
      historySource: 'fixtures/incidents/checkout-outage/history.json',
      logFormat: 'jsonl',
      historyFormat: 'culprit-json',
      eventCount: 2,
      commitCount: 1,
    },
    limits: { maxLogBytes: 1000000, maxEvents: 10000, maxStackLines: 50, truncated: false },
    warnings: ['Input is a supplied snapshot.'],
    assumptions: ['Event timestamps include an explicit offset.'],
    diagnostics: [{ source: 'analysis', code: 'TRACE', message: 'Vendor frame ignored for matching.', line: null, record: null }],
    incident: {
      status: 'spike',
      interpretation: 'Investigate the payment-path change first.',
      onset: {
        class: 'spike',
        windowStartUtc: '2026-10-19T10:00:00+05:30',
        windowEndUtc: '2026-10-19T10:05:00+05:30',
        baselineRate: 0,
        peakRate: 5,
        explanation: 'The error rate rises above the fixed baseline.',
      },
    },
    errors: [{
      signature: 'PaymentTimeout at src/checkout/payment.ts',
      representativeMessage: 'provider did not respond for order 1001',
      count: 2,
      firstSeenUtc: '2026-10-19T09:50:00+05:30',
      lastSeenUtc: '2026-10-19T09:51:00+05:30',
      eventIds: ['event-002', 'event-001'],
      stackFrames: [{ filePath: '.\\src\\checkout\\payment.ts', line: 118, column: 9, functionName: 'processPayment', vendor: false }],
    }],
    timeline: [{
      bucketStartUtc: '2026-10-19T10:00:00+05:30',
      bucketEndUtc: '2026-10-19T10:05:00+05:30',
      errorCount: 5,
      errorGroupSignatures: ['PaymentTimeout at src/checkout/payment.ts'],
      commitShas: ['2222222222222222222222222222222222222222'],
    }],
    suspects: [{
      rank: 1,
      sha: '2222222222222222222222222222222222222222',
      shortSha: '2222222',
      subject: 'refactor: add payment provider retry path',
      author: 'Jordan Lee',
      committedAtUtc: '2026-10-19T04:18:00Z',
      score: 0.875,
      signals: [
        {
          signal: 'trace-match',
          value: 1,
          weight: 0.5,
          contribution: 0.5,
          explanation: 'The first application frame overlaps a changed line range.',
          evidenceReferences: [{ type: 'file-range', sourceId: 'commit-222', path: 'src/checkout/payment.ts', lineStart: 104, lineEnd: 126, detail: 'Changed range contains frame line 118.' }],
        },
      ],
      evidenceReferences: [{ type: 'error-group', sourceId: 'PaymentTimeout at src/checkout/payment.ts', path: null, lineStart: null, lineEnd: null, detail: 'Two matching events.' }],
      tieBreakKey: '0.875|1|2026-10-19T04:18:00.000Z|2222222222222222222222222222222222222222',
    }],
    confidence: { band: 'medium', rationale: 'Strong trace evidence, but correlation is not causality.', scoreSeparation: null, evidenceCompleteness: 0.75 },
    tieBreak: { rule: 'score descending, trace match descending, commit time descending, SHA ascending', appliedOrder: ['score', 'trace-match', 'committedAtUtc', 'sha'] },
  };
}

describe('deterministic serialization', () => {
  it('produces byte-identical canonical JSON and UTC-normalized paths', () => {
    const result = makeResult();
    const first = serializeCanonicalJson(result);
    const second = serializeCanonicalJson(result);

    expect(first).toBe(second);
    expect(first).toContain('2026-10-19T04:30:00.000Z');
    expect(first).toContain('src/checkout/payment.ts');
    expect(first).not.toContain('\\\\');
    expect(first).not.toContain('C:');
  });

  it('projects fixed Markdown sections from result data and ends once', () => {
    const markdown = serializeMarkdown(makeResult());

    expect(markdown).toBe(serializeMarkdown(makeResult()));
    expect(markdown.endsWith('\n')).toBe(true);
    expect(markdown.endsWith('\n\n')).toBe(false);
    expect(markdown).toContain('## Verdict');
    expect(markdown).toContain('## Onset');
    expect(markdown).toContain('## Top suspects');
    expect(markdown).toContain('## Evidence');
    expect(markdown).toContain('## Confidence and caveats');
    expect(markdown).toContain('## Provenance');
    expect(markdown).toContain('## UTC disclosure');
    expect(markdown).toContain('## Warnings and diagnostics');
    expect(markdown).toContain('All timestamps in this report are normalized to UTC');
    expect(markdown).toContain('Strong trace evidence, but correlation is not causality.');
  });
});
