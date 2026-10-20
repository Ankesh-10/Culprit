import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AnalysisResult } from '../../src/core/model';
import { analyze, toAnalysisResult } from '../../src/core/pipeline';
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
      timeGapMinutes: 12,
      traceSummary: { matchKind: 'exact-line', matchedErrorCount: 2, lineLevelErrorCount: 2, totalErrorCount: 2 },
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
    ranking: {
      status: 'ranked',
      referenceUtc: '2026-10-19T10:00:00+05:30',
      eligibleCount: 1,
      considered: [{
        sha: '2222222222222222222222222222222222222222',
        shortSha: '2222222',
        subject: 'refactor: add payment provider retry path',
        author: 'Jordan Lee',
        committedAtUtc: '2026-10-19T04:18:00Z',
        status: 'top-three',
        rank: 1,
        score: 0.875,
        reason: null,
      }],
    },
    confidence: { band: 'medium', labels: [], rationale: 'Strong trace evidence, but correlation is not causality.', scoreSeparation: null, evidenceCompleteness: 0.75 },
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

  it('states the input limits in the Provenance section right after the Analysis line', () => {
    const lines = serializeMarkdown(makeResult()).split('\n');
    const analysisIndex = lines.findIndex((line) => line.startsWith('- Analysis: '));
    expect(analysisIndex).toBeGreaterThan(-1);
    expect(lines[analysisIndex + 1]).toBe('- Limits: 1000000 bytes of log text, 10000 events, 50 stack lines per event; input truncated: no');
  });

  it('flags truncated input in the Limits line', () => {
    const result = makeResult();
    result.limits = { ...result.limits, truncated: true };
    expect(serializeMarkdown(result)).toContain('- Limits: 1000000 bytes of log text, 10000 events, 50 stack lines per event; input truncated: yes');
  });
});

function checkoutResult(): AnalysisResult {
  const outcome = analyze({
    logs: { text: readFileSync(new URL('../../fixtures/incidents/checkout-outage/logs.jsonl', import.meta.url), 'utf8'), format: 'jsonl', source: 'fixtures/incidents/checkout-outage/logs.jsonl' },
    history: { text: readFileSync(new URL('../../fixtures/incidents/checkout-outage/history.json', import.meta.url), 'utf8'), format: 'culprit-json', source: 'fixtures/incidents/checkout-outage/history.json' },
    options: null,
  });
  if (!outcome.ok) throw outcome.error;
  return toAnalysisResult(outcome.stream);
}

describe('ranked Markdown export', () => {
  it('exports the checkout verdict with signals, totals, and the excluded commit', () => {
    const markdown = serializeMarkdown(checkoutResult());

    expect(markdown).toContain('- #1 `2222222` — refactor: add payment provider retry path');
    expect(markdown).toContain('Labels: none');
    expect(markdown).toContain('Confidence: **high**');
    expect(markdown).toContain('not probability or proof of causality');
    expect(markdown).toContain('### #1 `2222222`');
    expect(markdown).toMatch(/- trace-match: value 1 × weight 0\.3 = contribution 0\.3 — /);
    expect(markdown).toContain('Total score: 0.912065');
    expect(markdown).toContain('Not eligible: `3333333`');
    expect(markdown).toContain('- Leading suspect: `2222222`');
    expect(markdown).toContain('- Ranking: ranked; eligible commits: 2; reference (UTC): 2026-10-19T04:30:00.000Z');
    expect(markdown).toContain('- Assumption: ');
    expect(markdown).toBe(serializeMarkdown(checkoutResult()));
    expect(markdown).not.toMatch(/caused by|the culprit is|\d\s*%/i);
    expect(markdown.endsWith('\n')).toBe(true);
    expect(markdown.endsWith('\n\n')).toBe(false);
  });

  it('keeps the nine fixed headings in order', () => {
    const headings = serializeMarkdown(checkoutResult()).split('\n').filter((line) => /^#{1,2} /.test(line));
    expect(headings).toEqual([
      '# Culprit analysis',
      '## Verdict',
      '## Onset',
      '## Top suspects',
      '## Evidence',
      '## Confidence and caveats',
      '## Provenance',
      '## UTC disclosure',
      '## Warnings and diagnostics',
    ]);
  });

  it('cannot be hijacked by hostile commit, warning, or diagnostic text', () => {
    const result = makeResult();
    const suspect = result.suspects[0]!;
    suspect.subject = '# Owned\n[click](javascript:alert(1)) <script>x</script> `tick` *bold* _it_ a|b';
    suspect.author = 'Eve](x)';
    result.warnings = ['## fake heading'];
    result.diagnostics = [{ source: 'analysis', code: 'TRACE', message: '<img src=x>', line: null, record: null }];
    const considered = result.ranking.considered[0]!;
    considered.subject = suspect.subject;

    const markdown = serializeMarkdown(result);
    const headingLines = markdown.split('\n').filter((line) => line.startsWith('#'));

    expect(headingLines).toEqual([
      '# Culprit analysis',
      '## Verdict',
      '## Onset',
      '## Top suspects',
      '## Evidence',
      '### #1 `2222222` · \\# Owned \\[click\\](javascript:alert(1)) \\<script\\>x\\</script\\> \\`tick\\` \\*bold\\* \\_it\\_ a\\|b',
      '## Confidence and caveats',
      '## Provenance',
      '## UTC disclosure',
      '## Warnings and diagnostics',
    ]);
    expect(markdown).not.toContain('# Owned\n');
    expect(markdown).not.toContain('## fake');
    expect(markdown).toContain('\\[click\\]');
    expect(markdown).toContain('\\<script\\>');
    expect(markdown).not.toContain('[click](');
    expect(markdown).not.toContain('<script>');
    expect(markdown).not.toMatch(/(?:^|[^\\])</m);
    expect(markdown).toContain('\\<img src=x\\>');
    const suspectLine = markdown.split('\n').find((line) => line.startsWith('- #1 '));
    expect(suspectLine).toContain('Owned');
    expect(suspectLine).toContain('Eve\\](x)');
  });
});
