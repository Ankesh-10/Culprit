import { describe, expect, it } from 'vitest';
import type { AnalysisStream } from '../../src/core/model';
import { DIFF_NOTE, DRAWER_CAVEAT, SIGNAL_TITLES, buildDrawerView } from '../../src/ui/drawer-model';
import type { DrawerView } from '../../src/ui/drawer-model';
import { findCase, toAnalysisInput } from '../../src/ui/cases';
import { handleAnalyzeRequest } from '../../src/worker/protocol';

function bundledStream(id: string): AnalysisStream {
  const found = findCase(id);
  if (found === undefined) throw new Error(`missing case ${id}`);
  const response = handleAnalyzeRequest({ type: 'analyze', requestId: 1, input: toAnalysisInput(found) });
  if (response.type !== 'result') throw new Error('expected a result');
  return response.stream;
}

const CHECKOUT = bundledStream('checkout-outage');
const AMBIGUOUS = bundledStream('ambiguous');

function drawer(stream: AnalysisStream, rank: number): DrawerView {
  const view = buildDrawerView(stream, rank);
  if (view === null) throw new Error(`expected a drawer for rank ${rank}`);
  return view;
}

/** Every string reachable from a value, with the key path it was found at. */
function collectStrings(value: unknown, path = ''): Array<{ path: string; text: string }> {
  if (typeof value === 'string') return [{ path, text: value }];
  if (Array.isArray(value)) return value.flatMap((entry, index) => collectStrings(entry, `${path}[${index}]`));
  if (value !== null && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, entry]) => collectStrings(entry, `${path}.${key}`));
  }
  return [];
}

describe('buildDrawerView: checkout rank 1', () => {
  const view = drawer(CHECKOUT, 1);

  it('titles the drawer and links neighbours', () => {
    expect(view.rank).toBe(1);
    expect(view.title).toBe('#1 2222222');
    expect(view.subject).toBe('refactor: add payment provider retry path');
    expect(view.prevRank).toBeNull();
    expect(view.nextRank).toBe(2);
  });

  it('summarises the commit', () => {
    expect(view.summary.author).toBe('Jordan Lee');
    expect(view.summary.committed).toBe('2026-10-19 04:18 UTC');
    expect(view.summary.gap).toBe('12 min before onset window start');
    expect(view.summary.traceChip).toBe('Exact line');
    expect(view.summary.scoreText).toBe('0.912');
    expect(view.summary.scoreFraction).toBeCloseTo(0.912065, 6);
    expect(view.summary.fullSha).toHaveLength(40);
    expect(view.summary.fullSha.startsWith('2222222')).toBe(true);
  });

  it('shows exactly one row per ranking signal, in the fixed order, with the arithmetic', () => {
    expect(view.signals.map((row) => row.signal)).toEqual(['proximity', 'trace-match', 'novelty', 'churn']);
    expect(view.signals.map((row) => row.title)).toEqual([
      'Landed shortly before the onset',
      'Touches code named in the stack trace',
      'Errors are new in this log',
      'Size of the change',
    ]);
    expect(view.signals.map((row) => row.math)).toEqual([
      'value 0.900 \u00d7 weight 0.350 = 0.315',
      'value 1.000 \u00d7 weight 0.300 = 0.300',
      'value 1.000 \u00d7 weight 0.250 = 0.250',
      'value 0.471 \u00d7 weight 0.100 = 0.047',
    ]);
  });

  it('fills each bar with its share of the weight', () => {
    const fractions = view.signals.map((row) => row.barFraction);
    expect(fractions[0]).toBeCloseTo(0.9, 6);
    expect(fractions[1]).toBeCloseTo(1, 6);
    expect(fractions[2]).toBeCloseTo(1, 6);
    expect(fractions[3]).toBeCloseTo(0.470652, 6);
  });

  it('carries each explanation verbatim from the stream', () => {
    const suspect = CHECKOUT.ranking.suspects[0];
    const expected = ['proximity', 'trace-match', 'novelty', 'churn'].map(
      (name) => suspect?.signals.find((entry) => entry.signal === name)?.explanation,
    );
    expect(view.signals.map((row) => row.explanation)).toEqual(expected);
    for (const row of view.signals) expect(row.explanation.length).toBeGreaterThan(0);
  });

  it('closes with the total suspicion score line', () => {
    expect(view.total).toBe('Total suspicion score 0.912 (sum of the contributions above), rounded for display.');
  });
});

describe('buildDrawerView: lineup ends and unknown ranks', () => {
  it('links both neighbours in the middle of the ambiguous lineup', () => {
    const middle = drawer(AMBIGUOUS, 2);
    expect(middle.prevRank).toBe(1);
    expect(middle.nextRank).toBe(3);
  });

  it('ends the ambiguous lineup at rank 3', () => {
    const last = drawer(AMBIGUOUS, 3);
    expect(last.prevRank).toBe(2);
    expect(last.nextRank).toBeNull();
  });

  it('returns null for a rank outside the lineup', () => {
    expect(buildDrawerView(AMBIGUOUS, 4)).toBeNull();
    expect(buildDrawerView(CHECKOUT, 0)).toBeNull();
    expect(buildDrawerView(CHECKOUT, 4)).toBeNull();
  });
});

describe('signal titles and static wording', () => {
  it('pins the plain-language title map', () => {
    expect(SIGNAL_TITLES).toEqual({
      proximity: 'Landed shortly before the onset',
      'trace-match': 'Touches code named in the stack trace',
      novelty: 'Errors are new in this log',
      churn: 'Size of the change',
    });
  });

  it('pins the caveat and the diff note', () => {
    expect(DRAWER_CAVEAT).toBe(
      'This score ranks suspicion from timing, stack, novelty and change size. It is not proof that this commit caused the incident.',
    );
    expect(DIFF_NOTE).toBe(
      "Culprit's history export lists changed line ranges, not diff text. Open the commit in your repository to read the diff.",
    );
  });

  it('never claims cause, a found culprit or a percentage anywhere in the drawer views', () => {
    const banned = /\bcaused\b|root cause|culprit found|\d\s*%/i;
    const offenders: string[] = [];
    for (const stream of [CHECKOUT, AMBIGUOUS]) {
      for (const rank of [1, 2, 3]) {
        const view = buildDrawerView(stream, rank);
        if (view === null) continue;
        for (const entry of collectStrings(view)) {
          // The caveat deliberately says the score is not proof of cause.
          if (entry.text === DRAWER_CAVEAT) continue;
          if (banned.test(entry.text)) offenders.push(`${rank}${entry.path}: ${entry.text}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});

const MINUS = '\u2212';

function withLeadingReferences(stream: AnalysisStream, references: AnalysisStream['ranking']['suspects'][number]['evidenceReferences']): AnalysisStream {
  const [first, ...rest] = stream.ranking.suspects;
  if (first === undefined) throw new Error('expected a suspect');
  return { ...stream, ranking: { ...stream.ranking, suspects: [{ ...first, evidenceReferences: references }, ...rest] } };
}

function logEvent(path: string, line: number): AnalysisStream['ranking']['suspects'][number]['evidenceReferences'][number] {
  return { type: 'log-event', sourceId: `event-${line}`, path, lineStart: line, lineEnd: line, detail: `error at line ${line}` };
}

const PAYMENT = 'src/checkout/payment.ts';

describe('changed files and line ranges', () => {
  it('lists the checkout leader files in commit order with counts, ranges and the stack-frame overlap', () => {
    const view = drawer(CHECKOUT, 1);
    expect(view.files).toEqual([
      { path: PAYMENT, counts: `+46 ${MINUS}9`, ranges: [{ text: 'L104\u2013126', overlap: 'Overlaps stack frame at line 118' }] },
      { path: 'src/checkout/handler.ts', counts: `+8 ${MINUS}2`, ranges: [{ text: 'L36\u201349', overlap: null }] },
    ]);
    expect(view.diffNote).toBe(DIFF_NOTE);
  });

  it('builds a drawer with no files when the commit is not in the history', () => {
    const stream: AnalysisStream = { ...CHECKOUT, commits: CHECKOUT.commits.filter((commit) => !commit.sha.startsWith('2222222')) };
    const view = drawer(stream, 1);
    expect(view.files).toEqual([]);
    expect(view.diffNote).toBe(DIFF_NOTE);
    expect(view.signals).toHaveLength(4);
  });

  it('shows only package.json for the ambiguous leader, which has no trace match', () => {
    const view = drawer(AMBIGUOUS, 1);
    expect(view.summary.traceChip).toBe('No trace match');
    expect(view.files).toEqual([{ path: 'package.json', counts: `+3 ${MINUS}3`, ranges: [{ text: 'L12\u201314', overlap: null }] }]);
  });

  it('uses the smallest cited line inside the inclusive range, and ignores other paths and outside lines', () => {
    const lines = (...numbers: number[]) => withLeadingReferences(CHECKOUT, numbers.map((line) => logEvent(PAYMENT, line)));
    const overlapOf = (stream: AnalysisStream): string | null => drawer(stream, 1).files[0]?.ranges[0]?.overlap ?? null;
    expect(overlapOf(lines(118, 110, 120))).toBe('Overlaps stack frame at line 110');
    expect(overlapOf(lines(104))).toBe('Overlaps stack frame at line 104');
    expect(overlapOf(lines(126))).toBe('Overlaps stack frame at line 126');
    expect(overlapOf(lines(103, 127))).toBeNull();
    expect(overlapOf(withLeadingReferences(CHECKOUT, [logEvent('src/other.ts', 110)]))).toBeNull();
    expect(overlapOf(withLeadingReferences(CHECKOUT, []))).toBeNull();
  });

  it('writes a one-line range as a single line number', () => {
    const stream: AnalysisStream = {
      ...CHECKOUT,
      commits: CHECKOUT.commits.map((commit) =>
        commit.sha.startsWith('2222222') ? { ...commit, files: [{ path: PAYMENT, added: 1, deleted: 0, ranges: [{ start: 7, end: 7 }] }] } : commit,
      ),
    };
    expect(drawer(stream, 1).files[0]?.ranges[0]?.text).toBe('L7');
  });
});

describe('evidence list', () => {
  const view = drawer(CHECKOUT, 1);
  const signature = CHECKOUT.errors[0]?.signature ?? '';

  it('lists every evidence reference in order with a type label, location and detail', () => {
    const suspect = CHECKOUT.ranking.suspects[0];
    expect(view.evidence).toHaveLength(9);
    expect(view.evidence.map((item) => item.typeLabel)).toEqual([
      'Feature',
      'File range',
      'Error group',
      'Log event',
      'Log event',
      'Log event',
      'Error group',
      'File range',
      'File range',
    ]);
    expect(view.evidence.map((item) => item.detail)).toEqual((suspect?.evidenceReferences ?? []).map((reference) => reference.detail));
    expect(view.evidence.map((item) => item.location)).toEqual([
      null,
      `${PAYMENT}:104\u2013126`,
      null,
      `${PAYMENT}:118`,
      `${PAYMENT}:118`,
      `${PAYMENT}:118`,
      null,
      'src/checkout/handler.ts:36\u201349',
      `${PAYMENT}:104\u2013126`,
    ]);
  });

  it('offers the log-line action only for error-group and log-event items, keyed by signature', () => {
    expect(signature).not.toBe('');
    expect(view.evidence.map((item) => item.action)).toEqual([
      null,
      null,
      { signature },
      { signature },
      { signature },
      { signature },
      { signature },
      null,
      null,
    ]);
  });

  it('gives a log event that belongs to no error group no action', () => {
    const orphan = 'source-298db3a5-1';
    const stream: AnalysisStream = {
      ...CHECKOUT,
      errors: CHECKOUT.errors.map((group) => ({ ...group, eventIds: group.eventIds.filter((id) => id !== orphan) })),
    };
    const items = drawer(stream, 1).evidence;
    expect(items[3]?.typeLabel).toBe('Log event');
    expect(items[3]?.action).toBeNull();
    expect(items[4]?.action).toEqual({ signature });
    expect(items[5]?.action).toEqual({ signature });
  });

  it('lists only the evidence that exists for the ambiguous leader', () => {
    const items = drawer(AMBIGUOUS, 1).evidence;
    const suspect = AMBIGUOUS.ranking.suspects[0];
    expect(items.map((item) => item.detail)).toEqual((suspect?.evidenceReferences ?? []).map((reference) => reference.detail));
    expect(items.some((item) => item.typeLabel === 'Log event')).toBe(false);
  });
});
