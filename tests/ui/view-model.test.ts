import { describe, expect, it } from 'vitest';
import type { AnalysisInput, AnalysisStream } from '../../src/core/model';
import { findCase, toAnalysisInput } from '../../src/ui/cases';
import { analyze } from '../../src/core/pipeline';
import {
  CONSIDERED_PAGE_SIZE,
  buildConsideredRows,
  buildErrorSummary,
  buildShortlistView,
  buildTrustFooterView,
  buildVerdictView,
  pageConsidered,
} from '../../src/ui/view-model';
import type { ConsideredRow } from '../../src/ui/view-model';
import { buildOwnAnalysisInput, emptyDraft, sourcesFor } from '../../src/ui/intake';
import type { AnalysisFailure } from '../../src/worker/protocol';
import { handleAnalyzeRequest } from '../../src/worker/protocol';

function bundledStream(id: string): AnalysisStream {
  const found = findCase(id);
  if (found === undefined) throw new Error(`missing case ${id}`);
  const response = handleAnalyzeRequest({ type: 'analyze', requestId: 1, input: toAnalysisInput(found) });
  if (response.type !== 'result') throw new Error('expected a result');
  return response.stream;
}

const CHECKOUT = bundledStream('checkout-outage');
const SLOW_BURN = bundledStream('slow-burn');
const AMBIGUOUS = bundledStream('ambiguous');

describe('buildVerdictView', () => {
  it('shows every evidence fact for the checkout case', () => {
    const view = buildVerdictView(CHECKOUT);
    if (view === null) throw new Error('expected a verdict');
    expect(view.caution).toBeNull();
    expect(view.headline).toEqual({
      mode: 'suspect',
      shortSha: '2222222',
      subject: 'refactor: add payment provider retry path',
    });
    expect(view.facts.map((fact) => [fact.key, fact.label])).toEqual([
      ['author', 'Author'],
      ['committed', 'Committed'],
      ['gap', 'Time gap'],
      ['onset', 'Onset'],
      ['files', 'Files and lines'],
      ['matches', 'Matching errors'],
    ]);
    const byKey = new Map(view.facts.map((fact) => [fact.key, fact]));
    expect(byKey.get('author')?.value).toBe('Jordan Lee');
    expect(byKey.get('committed')?.value).toBe('2026-10-19 04:18 UTC');
    expect(byKey.get('gap')?.value).toBe('12 min before onset window start');
    expect(byKey.get('onset')?.value).toBe(CHECKOUT.onset.explanation);
    expect(byKey.get('files')?.values).toEqual(['src/checkout/payment.ts:104–126', 'src/checkout/handler.ts:36–49']);
    expect(byKey.get('files')?.moreCount).toBe(0);
    expect(byKey.get('matches')?.value).toBe('Matches 5 of 5 errors');
    expect(view.traceChip).toBe('Exact line');
    expect(view.score.value).toBeCloseTo(0.912065, 6);
    expect(view.score.text).toBe('0.91');
    expect(view.score.fraction).toBeCloseTo(0.912065, 6);
    expect(view.scoreHelper).toBe('Suspicion score from 0 to 1. This is ranked suspicion, not probability.');
    const leading = CHECKOUT.ranking.suspects[0];
    expect(view.evidencePreview).toEqual((leading?.evidenceReferences ?? []).slice(0, 3).map((ref) => ref.detail));
    expect(view.evidencePreview.length).toBeGreaterThan(0);
    expect(view.confidence.hasLabels).toBe(false);
  });

  it('shows the caution banner, ordered chips and leading candidate for the ambiguous case', () => {
    const view = buildVerdictView(AMBIGUOUS);
    if (view === null) throw new Error('expected a verdict');
    expect(view.caution).toEqual({
      lead: 'Low confidence. Treat these as leads to check, not a diagnosis.',
      chips: ['Low confidence', 'Ambiguous', 'Weak evidence', 'No clear culprit'],
    });
    expect(view.headline.mode).toBe('no-clear-culprit');
    expect(view.headline.shortSha).toBe('9999999');
    expect(view.traceChip).toBe('No trace match');
    const byKey = new Map(view.facts.map((fact) => [fact.key, fact]));
    expect(byKey.get('matches')?.value).toBe('Matches 0 of 4 errors');
    expect(byKey.get('files')?.values).toEqual(['package.json:12–14']);
    expect(view.confidence.hasLabels).toBe(true);
  });

  it('carries the ramp caveat and medium confidence for slow-burn', () => {
    const view = buildVerdictView(SLOW_BURN);
    if (view === null) throw new Error('expected a verdict');
    const byKey = new Map(view.facts.map((fact) => [fact.key, fact]));
    expect(byKey.get('onset')?.value.startsWith('Gradual ramp interpretation:')).toBe(true);
    expect(byKey.get('gap')?.value).toBe('38 min before onset window start');
    expect(view.confidence.text).toBe('Ranking confidence: Medium');
  });
});

function noEligibleStream(): AnalysisStream {
  const errorLine = (timestamp: string): string => `${timestamp} error request failed`;
  const input: AnalysisInput = {
    logs: {
      format: 'plain-text',
      text: [
        errorLine('2026-10-19T07:00:00Z'),
        errorLine('2026-10-19T07:05:00Z'),
        ...Array.from({ length: 4 }, () => errorLine('2026-10-19T07:10:00Z')),
      ].join('\n'),
    },
    history: {
      format: 'culprit-json',
      text: JSON.stringify({
        schemaVersion: 1,
        format: 'culprit-json',
        repository: 'test-service',
        commits: [
          {
            sha: 'a'.repeat(40),
            author: 'Test Author',
            timestamp: '2026-10-19T07:12:00Z',
            message: 'test change',
            files: [{ path: 'src/test.ts', added: 3, deleted: 1, ranges: [{ start: 1, end: 5 }] }],
          },
        ],
      }),
    },
    options: null,
  };
  const outcome = analyze(input);
  if (!outcome.ok) throw new Error('synthetic input failed to analyze');
  return outcome.stream;
}

describe('buildShortlistView', () => {
  it('returns one row per suspect', () => {
    expect(buildShortlistView(CHECKOUT)?.rows).toHaveLength(2);
    expect(buildShortlistView(SLOW_BURN)?.rows).toHaveLength(3);
    expect(buildShortlistView(AMBIGUOUS)?.rows).toHaveLength(3);
  });

  it('returns null when there are no suspects', () => {
    expect(buildShortlistView(noEligibleStream())).toBeNull();
  });

  it('describes the checkout lineup', () => {
    const view = buildShortlistView(CHECKOUT);
    if (view === null) throw new Error('expected a lineup');
    expect(view.heading).toBe('Suspect lineup');
    expect(view.countText).toBe('2 suspects');
    const [first, second] = view.rows;
    expect(first).toMatchObject({
      rank: 1,
      rankLabel: '#1',
      leading: true,
      diamond: 'leading',
      shortSha: '2222222',
      subject: 'refactor: add payment provider retry path',
      byline: 'Jordan Lee · 2026-10-19 04:18 UTC',
      gap: '12 min before onset',
      scoreText: '0.91',
      traceChip: 'Exact line',
      matches: 'Matches 5 of 5 errors',
    });
    expect(second).toMatchObject({
      rank: 2,
      leading: false,
      diamond: 'ranked',
      shortSha: '1111111',
      gap: '25 min before onset',
      traceChip: 'No trace match',
      matches: 'Matches 0 of 5 errors',
    });
    expect(first?.scoreFraction).toBeCloseTo(0.912065, 6);
  });
});

describe('buildConsideredRows', () => {
  it('lists every supplied commit in considered order with exclusions explicit', () => {
    const view = buildConsideredRows(CHECKOUT);
    expect(view.summary).toBe('Commits considered (3)');
    expect(view.rows.map((row) => row.shortSha)).toEqual(CHECKOUT.ranking.considered.map((entry) => entry.shortSha));
    const bySha = new Map(view.rows.map((row) => [row.shortSha, row]));
    expect(bySha.get('1111111')).toMatchObject({ rank: '2', status: 'Top three', score: '0.54' });
    expect(bySha.get('2222222')).toMatchObject({ rank: '1', status: 'Top three', score: '0.91' });
    const excluded = bySha.get('3333333');
    expect(excluded).toMatchObject({ rank: '—', status: 'Excluded', score: '—' });
    expect(excluded?.reason).toContain('after the onset window start');
  });

  it('maps a scored disposition to Scored with its rank and score', () => {
    const stream = structuredClone(CHECKOUT);
    stream.ranking.considered = stream.ranking.considered.map((entry) =>
      entry.shortSha === '3333333' ? { ...entry, status: 'scored' as const, rank: 4, score: 0.123, reason: null } : entry,
    );
    const row = buildConsideredRows(stream).rows.find((entry) => entry.shortSha === '3333333');
    expect(row).toMatchObject({ rank: '4', status: 'Scored', score: '0.12', reason: '' });
  });
});

describe('pageConsidered', () => {
  function rowsOf(count: number): ConsideredRow[] {
    return Array.from({ length: count }, (_unused, index) => ({
      rank: String(index + 1),
      shortSha: index.toString(16).padStart(7, '0'),
      subject: `commit ${index}`,
      status: 'Scored' as const,
      score: '0.10',
      reason: '',
    }));
  }

  it('pages 250 rows 100 at a time and states the true total', () => {
    expect(CONSIDERED_PAGE_SIZE).toBe(100);
    const first = pageConsidered(rowsOf(250), 100);
    expect(first.rows).toHaveLength(100);
    expect(first.total).toBe(250);
    expect(first.hasMore).toBe(true);
    expect(first.countText).toBe('Showing 100 of 250 commits');
    expect(pageConsidered(rowsOf(250), 200).rows).toHaveLength(200);
    const last = pageConsidered(rowsOf(250), 300);
    expect(last.rows).toHaveLength(250);
    expect(last.hasMore).toBe(false);
    expect(last.countText).toBeNull();
  });

  it('handles an empty list and every bundled case without a next page', () => {
    expect(pageConsidered([], 100)).toEqual({ rows: [], total: 0, hasMore: false, countText: null });
    for (const stream of [CHECKOUT, SLOW_BURN, AMBIGUOUS]) {
      const view = pageConsidered(buildConsideredRows(stream).rows, CONSIDERED_PAGE_SIZE);
      expect(view.hasMore).toBe(false);
      expect(view.countText).toBeNull();
    }
  });

  it('keeps the input order and formats large totals with separators', () => {
    const rows = rowsOf(3000);
    const view = pageConsidered(rows, 100);
    expect(view.rows.map((row) => row.shortSha)).toEqual(rows.slice(0, 100).map((row) => row.shortSha));
    expect(view.countText).toBe('Showing 100 of 3,000 commits');
  });
});

describe('wording guard', () => {
  const BANNED = /\bcaused\b|root cause|culprit found|broke production|\d\s*%/i;

  function strings(value: unknown, into: string[] = []): string[] {
    if (typeof value === 'string') into.push(value);
    else if (Array.isArray(value)) for (const item of value) strings(item, into);
    else if (value !== null && typeof value === 'object') for (const item of Object.values(value)) strings(item, into);
    return into;
  }

  it.each([
    ['checkout-outage', CHECKOUT],
    ['slow-burn', SLOW_BURN],
    ['ambiguous', AMBIGUOUS],
  ])('keeps proof and percentage claims out of %s', (_id, stream) => {
    const all = [...strings(buildVerdictView(stream)), ...strings(buildShortlistView(stream)), ...strings(buildConsideredRows(stream))];
    expect(all.length).toBeGreaterThan(10);
    expect(all.filter((text) => BANNED.test(text))).toEqual([]);
  });
});

describe('buildTrustFooterView', () => {
  const UTC_NOTE = 'All timestamps are normalized to UTC and shown without local conversion.';
  const LIMITS = 'Limits: 1 MiB of log text, 10,000 events, 100 stack lines per event';

  it('lists the single warning of the ambiguous case with a count chip and every caveat', () => {
    const view = buildTrustFooterView(AMBIGUOUS);
    expect(view.heading).toBe('Warnings and caveats');
    expect(view.countChip).toBe('1 warning');
    expect(view.items).toEqual([
      { code: null, line: null, message: 'No grouped application stack path overlaps the supplied history files; evidence remains weak or competing.' },
    ]);
    expect(view.assumptionsSummary).toBe('UTC · local · not proof');
    expect(view.assumptions).toEqual(AMBIGUOUS.assumptions);
    expect(view.assumptions.length).toBeGreaterThan(0);
    expect(view.rationale).toBe(AMBIGUOUS.ranking.confidence.rationale);
    expect(view.versions).toBe('analysis-v1 · scoring-v1 · schema 1');
    expect(view.limits).toBe(LIMITS);
    expect(view.utcNote).toBe(UTC_NOTE);
    expect(view.truncationBanner).toBeNull();
  });

  it('has no chip and no items for the checkout case but keeps the caveats', () => {
    const view = buildTrustFooterView(CHECKOUT);
    expect(view.countChip).toBeNull();
    expect(view.items).toEqual([]);
    expect(view.assumptionsSummary).toBe('UTC · local · not proof');
    expect(view.limits).toBe(LIMITS);
    expect(view.utcNote).toBe(UTC_NOTE);
  });

  it('describes provenance with sources, formats and counts', () => {
    expect(buildTrustFooterView(CHECKOUT).provenance).toEqual([
      'Logs: fixtures/incidents/checkout-outage/logs.jsonl (jsonl, 6 events)',
      'History: fixtures/incidents/checkout-outage/history.json (culprit-json, 3 commits)',
    ]);
  });

  it('uses singular nouns for single counts in provenance', () => {
    const single = { ...CHECKOUT, provenance: { ...CHECKOUT.provenance, eventCount: 1, commitCount: 1 } };
    expect(buildTrustFooterView(single).provenance).toEqual([
      'Logs: fixtures/incidents/checkout-outage/logs.jsonl (jsonl, 1 event)',
      'History: fixtures/incidents/checkout-outage/history.json (culprit-json, 1 commit)',
    ]);
  });

  it('shows the truncation banner and renders diagnostics after warnings', () => {
    const synthetic: AnalysisStream = {
      ...AMBIGUOUS,
      limits: { ...AMBIGUOUS.limits, truncated: true },
      diagnostics: [
        { source: 'logs', code: 'MALFORMED_RECORD', message: 'Record could not be read.', line: 4, record: null },
        { source: 'history', code: 'EMPTY_RANGE', message: 'No ranges.', line: null, record: 2 },
      ],
    };
    const view = buildTrustFooterView(synthetic);
    expect(view.truncationBanner).toBe('Input was truncated at the limit; results use only the lines that were read.');
    expect(view.countChip).toBe('3 warnings');
    expect(view.items.map((item) => [item.code, item.line])).toEqual([
      [null, null],
      ['logs/MALFORMED_RECORD', 'line 4'],
      ['history/EMPTY_RANGE', null],
    ]);
    expect(view.items[1]?.message).toBe('Record could not be read.');
  });

  it('formats a limit that is not a whole MiB with one decimal', () => {
    const odd = { ...CHECKOUT, limits: { ...CHECKOUT.limits, maxLogBytes: 1572864 } };
    expect(buildTrustFooterView(odd).limits).toBe('Limits: 1.5 MiB of log text, 10,000 events, 100 stack lines per event');
  });
});

describe('buildErrorSummary', () => {
  const SOURCES = { logs: 'pasted-log', history: 'pasted-history' };
  const checkout = findCase('checkout-outage');
  if (checkout === undefined) throw new Error('missing checkout case');

  type Diagnostic = AnalysisFailure['diagnostics'][number];

  function failureFor(logText: string, historyText: string): AnalysisFailure {
    const draft = emptyDraft();
    const input = buildOwnAnalysisInput({
      ...draft,
      log: { ...draft.log, text: logText },
      history: { ...draft.history, text: historyText },
    });
    const response = handleAnalyzeRequest({ type: 'analyze', requestId: 1, input });
    if (response.type !== 'error') throw new Error('expected a failure');
    return response.failure;
  }

  function failure(diagnostics: Diagnostic[], code = 'MALFORMED_RECORD'): AnalysisFailure {
    return { code, message: 'x', diagnostics };
  }

  function diagnostic(over: Partial<Diagnostic>): Diagnostic {
    return { source: 'pasted-log', code: 'MALFORMED_RECORD', message: 'm', line: null, record: null, field: null, ...over };
  }

  it('carries the heading and generic body', () => {
    const summary = buildErrorSummary(failure([diagnostic({})]), SOURCES);
    expect(summary.heading).toBe("We couldn't analyze these inputs");
    expect(summary.body).toBe(
      'Nothing was uploaded and nothing changed. Fix the item below and analyze again, or load a bundled incident to compare formats.',
    );
  });

  it('maps a real empty log to the log field', () => {
    const summary = buildErrorSummary(failureFor('', checkout.historyText), SOURCES);
    expect(summary.entries[0]).toMatchObject({
      field: 'log',
      text: 'The log is empty. Choose a file or paste text, then analyze again.',
      fixTarget: 'log',
    });
  });

  it('maps a real empty history to the history field', () => {
    const summary = buildErrorSummary(failureFor(checkout.logsText, ''), SOURCES);
    const entry = summary.entries.find((candidate) => candidate.field === 'history');
    expect(entry?.text).toBe('The git history is empty. Choose a file or paste text, then analyze again.');
    expect(entry?.fixTarget).toBe('history');
  });

  it('maps a real invalid history to the no-line copy', () => {
    const summary = buildErrorSummary(failureFor(checkout.logsText, '{'), SOURCES);
    const entry = summary.entries.find((candidate) => candidate.field === 'history');
    expect(entry?.text).toBe("The git history couldn't be read. Fix the file, then analyze again.");
  });

  it('maps malformed records by line, by record and with neither', () => {
    const byLine = buildErrorSummary(failure([diagnostic({ line: 7 })]), SOURCES).entries[0];
    expect(byLine?.text).toBe("Line 7 of the log couldn't be read. Fix or remove that line, then analyze again.");
    const byRecord = buildErrorSummary(failure([diagnostic({ source: 'pasted-history', record: 2 })]), SOURCES).entries[0];
    expect(byRecord?.text).toBe("Record 2 of the git history couldn't be read. Fix or remove that record, then analyze again.");
    expect(byRecord?.fixTarget).toBe('history');
    const bare = buildErrorSummary(failure([diagnostic({})]), SOURCES).entries[0];
    expect(bare?.text).toBe("The log couldn't be read. Fix the file, then analyze again.");
  });

  it('maps unsupported format and the input limit', () => {
    const unsupported = buildErrorSummary(failure([diagnostic({ code: 'UNSUPPORTED_FORMAT' })], 'UNSUPPORTED_FORMAT'), SOURCES).entries[0];
    expect(unsupported?.text).toBe(
      "This format isn't supported. Use a JSON-lines log or plain text with ISO timestamps and levels, plus a Culprit JSON history export. The README lists the supported formats.",
    );
    const limit = buildErrorSummary(failure([diagnostic({ code: 'INPUT_LIMIT' })], 'INPUT_LIMIT'), SOURCES).entries[0];
    expect(limit?.text).toBe('This input is over the limit of 1 MiB or 10,000 events. Trim the log to the incident window and try again.');
  });

  it('prefixes other codes with the field and appends the line', () => {
    const entry = buildErrorSummary(
      failure(
        [diagnostic({ source: 'pasted-history', code: 'HISTORY_VALIDATION', message: 'History commits must be a non-empty array.', line: 3 })],
        'HISTORY_VALIDATION',
      ),
      SOURCES,
    ).entries[0];
    expect(entry?.text).toBe('Check git history: History commits must be a non-empty array. (line 3)');
  });

  it('keeps analysis-level errors without a fix target', () => {
    const entry = buildErrorSummary(
      failure([diagnostic({ source: 'analysis', code: 'INVALID_ANALYSIS_INPUT' as Diagnostic['code'], message: 'Bad source.' })], 'INVALID_ANALYSIS_INPUT'),
      SOURCES,
    ).entries[0];
    expect(entry?.field).toBe('analysis');
    expect(entry?.text.startsWith('Check analysis input:')).toBe(true);
    expect(entry?.fixTarget).toBeNull();
  });

  it('falls back to the failure message when there are no diagnostics', () => {
    const summary = buildErrorSummary({ code: 'INTERNAL_ERROR', message: 'Analysis stopped unexpectedly: boom', diagnostics: [] }, SOURCES);
    expect(summary.entries).toHaveLength(1);
    expect(summary.entries[0]?.text).toBe('Analysis stopped unexpectedly: boom');
    expect(summary.entries[0]?.fixTarget).toBeNull();
  });

  it('caps the list at 20 entries and says how many are hidden', () => {
    const many = Array.from({ length: 25 }, (_, index) => diagnostic({ line: index + 1 }));
    const summary = buildErrorSummary(failure(many), SOURCES);
    expect(summary.entries).toHaveLength(20);
    expect(summary.moreText).toBe('5 more diagnostics are not shown.');
    expect(buildErrorSummary(failure([diagnostic({ line: 1 })]), SOURCES).moreText).toBeNull();
  });

  it('never claims causation or a probability', () => {
    const samples = [
      failureFor('', checkout.historyText),
      failureFor(checkout.logsText, '{'),
      failure([diagnostic({ code: 'UNSUPPORTED_FORMAT' }), diagnostic({ code: 'INPUT_LIMIT' }), diagnostic({ line: 4 })]),
    ];
    for (const sample of samples) {
      const summary = buildErrorSummary(sample, SOURCES);
      for (const text of [summary.heading, summary.body, ...summary.entries.map((entry) => entry.text)]) {
        expect(text).not.toMatch(/\bcaused\b|root cause|culprit found|\d\s*%/i);
      }
    }
  });

  it('maps bundled-case fixture sources to the same fields', () => {
    const bundledSources = { logs: checkout.logsSource, history: checkout.historySource };
    const entry = buildErrorSummary(
      failure([diagnostic({ source: checkout.historySource, code: 'EMPTY_INPUT' })], 'EMPTY_INPUT'),
      bundledSources,
    ).entries[0];
    expect(entry?.field).toBe('history');
  });

  it('reads the pasted source names for an empty draft', () => {
    expect(sourcesFor(emptyDraft())).toEqual(SOURCES);
  });
});
