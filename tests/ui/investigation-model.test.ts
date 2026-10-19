import { describe, expect, it } from 'vitest';
import type { AnalysisInput, AnalysisStream } from '../../src/core/model';
import { analyze } from '../../src/core/pipeline';
import { findCase, toAnalysisInput } from '../../src/ui/cases';
import {
  LOG_EMPTY_TEXT,
  LOG_PAGE_SIZE,
  buildLogPanelView,
  buildReadout,
  buildSeries,
  buildSignatureRows,
  buildTableTwinRows,
  countForSignature,
  defaultBucketIndex,
  initialInvestigation,
  investigationContext,
  peakBucketIndex,
  reduceInvestigation,
  selectLogLines,
} from '../../src/ui/investigation-model';
import type { InvestigationState } from '../../src/ui/investigation-model';
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

function at(stream: AnalysisStream, index: number): InvestigationState {
  return { ...initialInvestigation(stream), selectedIndex: index };
}

describe('default and peak selection', () => {
  it('selects the onset interval for each bundled case', () => {
    expect([CHECKOUT, SLOW_BURN, AMBIGUOUS].map(defaultBucketIndex)).toEqual([2, 2, 1]);
    expect([CHECKOUT, SLOW_BURN, AMBIGUOUS].map((stream) => initialInvestigation(stream).selectedIndex)).toEqual([2, 2, 1]);
  });

  it('finds the first maximum as the peak', () => {
    expect([CHECKOUT, SLOW_BURN, AMBIGUOUS].map((stream) => peakBucketIndex(stream.timeline))).toEqual([2, 1, 1]);
  });

  it('starts with the log panel closed and one page of rows', () => {
    const initial = initialInvestigation(CHECKOUT);
    expect(initial.logPanel).toEqual({ open: false, visible: LOG_PAGE_SIZE, scope: 'bucket' });
    expect(initial.filter).toBeNull();
    expect(initial.tableVisible).toBe(LOG_PAGE_SIZE);
  });
});

describe('buildReadout', () => {
  it('states the checkout onset interval in text with a log button', () => {
    const readout = buildReadout(CHECKOUT, initialInvestigation(CHECKOUT));
    expect(readout.text).toBe('04:30–04:35 UTC · 3 errors · 1 signature · Inside onset window');
    expect(readout.valueText).toBe(readout.text);
    expect(readout.logButtonLabel).toBe('Show log lines (3)');
    expect(readout.logCount).toBe(3);
  });

  it('omits the onset phrase outside the window', () => {
    const readout = buildReadout(CHECKOUT, at(CHECKOUT, 0));
    expect(readout.text).toBe('04:20–04:25 UTC · 2 errors · 1 signature');
    expect(buildReadout(CHECKOUT, at(CHECKOUT, 1)).text).toBe('04:25–04:30 UTC · 0 errors · 0 signatures');
  });

  it('lists commit short hashes when the interval holds commits', () => {
    const outcome = analyze({
      logs: {
        text: [
          '2026-10-19T07:00:00Z error request failed',
          '2026-10-19T07:05:00Z error request failed',
          '2026-10-19T07:10:00Z error request failed',
        ].join('\n'),
        format: 'plain-text',
      },
      history: {
        text: JSON.stringify({
          schemaVersion: 1,
          format: 'culprit-json',
          repository: 'test-service',
          commits: [
            {
              sha: 'a'.repeat(40),
              author: 'Test Author',
              timestamp: '2026-10-19T07:00:00Z',
              message: 'test change',
              files: [{ path: 'src/test.ts', added: 3, deleted: 1, ranges: [{ start: 1, end: 5 }] }],
            },
          ],
        }),
        format: 'culprit-json',
      },
      options: null,
    } satisfies AnalysisInput);
    if (!outcome.ok) throw new Error('analysis failed');
    const readout = buildReadout(outcome.stream, at(outcome.stream, 0));
    expect(readout.text.endsWith(' · Commits aaaaaaa')).toBe(true);
  });
});

describe('reduceInvestigation', () => {
  const context = investigationContext(SLOW_BURN);

  it('clamps stepping at both ends', () => {
    const first = at(SLOW_BURN, 0);
    expect(reduceInvestigation(first, { type: 'step', delta: -1 }, context)).toBe(first);
    const last = at(SLOW_BURN, 7);
    expect(reduceInvestigation(last, { type: 'step', delta: 1 }, context)).toBe(last);
    expect(reduceInvestigation(at(SLOW_BURN, 3), { type: 'step', delta: 1 }, context).selectedIndex).toBe(4);
  });

  it('moves by twelve and clamps for PageUp and PageDown', () => {
    expect(reduceInvestigation(at(SLOW_BURN, 5), { type: 'step', delta: 12 }, context).selectedIndex).toBe(7);
    expect(reduceInvestigation(at(SLOW_BURN, 5), { type: 'step', delta: -12 }, context).selectedIndex).toBe(0);
  });

  it('jumps to onset, peak, first and last', () => {
    const state = at(SLOW_BURN, 5);
    expect(reduceInvestigation(state, { type: 'jump', target: 'onset' }, context).selectedIndex).toBe(2);
    expect(reduceInvestigation(state, { type: 'jump', target: 'peak' }, context).selectedIndex).toBe(1);
    expect(reduceInvestigation(state, { type: 'jump', target: 'first' }, context).selectedIndex).toBe(0);
    expect(reduceInvestigation(state, { type: 'jump', target: 'last' }, context).selectedIndex).toBe(7);
    const noOnset = { ...context, onsetIndex: null };
    expect(reduceInvestigation(state, { type: 'jump', target: 'onset' }, noOnset)).toBe(state);
  });

  it('opens, pages and closes the log panel, resetting paging on a new selection', () => {
    let state = initialInvestigation(SLOW_BURN);
    state = reduceInvestigation(state, { type: 'open-log-lines' }, context);
    expect(state.logPanel.open).toBe(true);
    state = reduceInvestigation(state, { type: 'show-more-log-lines' }, context);
    expect(state.logPanel.visible).toBe(LOG_PAGE_SIZE * 2);
    state = reduceInvestigation(state, { type: 'select', index: 4 }, context);
    expect(state.logPanel).toEqual({ open: true, visible: LOG_PAGE_SIZE, scope: 'bucket' });
    state = reduceInvestigation(state, { type: 'close-log-lines' }, context);
    expect(state.logPanel.open).toBe(false);
    expect(reduceInvestigation(state, { type: 'show-more-table-rows' }, context).tableVisible).toBe(LOG_PAGE_SIZE * 2);
  });

  it('clamps an out-of-range selection', () => {
    expect(reduceInvestigation(at(SLOW_BURN, 2), { type: 'select', index: 99 }, context).selectedIndex).toBe(7);
    expect(reduceInvestigation(at(SLOW_BURN, 2), { type: 'select', index: -4 }, context).selectedIndex).toBe(0);
  });
});

describe('log lines', () => {
  it('lists the three checkout onset events in time order', () => {
    const events = selectLogLines(CHECKOUT, initialInvestigation(CHECKOUT));
    expect(events).toHaveLength(3);
    const stamps = events.map((event) => event.timestampUtc);
    expect([...stamps].sort()).toEqual(stamps);
    expect(events.every((event) => event.level === 'error')).toBe(true);
  });

  it('builds a panel view with heading, total, rows and no empty text', () => {
    const view = buildLogPanelView(CHECKOUT, initialInvestigation(CHECKOUT));
    expect(view.heading).toBe('Log lines · 04:30–04:35 UTC · 3 events');
    expect(view.total).toBe(3);
    expect(view.rows).toHaveLength(3);
    expect(view.hasMore).toBe(false);
    expect(view.emptyText).toBeNull();
    const first = view.rows[0];
    expect(first?.level).toBe('ERROR');
    expect(first?.time).toMatch(/^\d{2}:\d{2}:\d{2}$/);
    expect(first?.line).toMatch(/^\d+$/);
    expect(first?.stack).toContain('processPayment');
  });

  it('shows the empty text for the quiet 04:25 interval', () => {
    const state = at(CHECKOUT, 1);
    expect(selectLogLines(CHECKOUT, state)).toEqual([]);
    const view = buildLogPanelView(CHECKOUT, state);
    expect(view.total).toBe(0);
    expect(view.rows).toEqual([]);
    expect(view.emptyText).toBe(LOG_EMPTY_TEXT);
    expect(view.heading).toBe('Log lines · 04:25–04:30 UTC · 0 events');
  });
});

describe('buildTableTwinRows', () => {
  it('has one row per interval for every bundled case', () => {
    const counts = [CHECKOUT, SLOW_BURN, AMBIGUOUS].map((stream) => {
      const view = buildTableTwinRows(stream, initialInvestigation(stream));
      expect(view.rows).toHaveLength(stream.timeline.length);
      expect(view.total).toBe(stream.timeline.length);
      expect(view.hasMore).toBe(false);
      return view.rows.length;
    });
    expect(counts).toEqual([3, 8, 5]);
  });

  it('flags the onset window in text', () => {
    const checkout = buildTableTwinRows(CHECKOUT, initialInvestigation(CHECKOUT));
    expect(checkout.rows.map((row) => row.onset)).toEqual(['—', '—', 'Yes']);
    const ambiguous = buildTableTwinRows(AMBIGUOUS, initialInvestigation(AMBIGUOUS));
    expect(ambiguous.rows.map((row) => row.onset)).toEqual(['—', 'Yes', 'Yes', 'Yes', 'Yes']);
  });

  it('states interval, errors, signatures and commits for each row', () => {
    const rows = buildTableTwinRows(CHECKOUT, initialInvestigation(CHECKOUT)).rows;
    expect(rows[2]).toEqual({
      index: 2,
      interval: '04:30–04:35 UTC',
      errors: 3,
      signatures: 1,
      onset: 'Yes',
      commits: '—',
    });
    expect(rows[1]?.errors).toBe(0);
  });

  it('renders only the visible slice and reports when more exist', () => {
    const partial = buildTableTwinRows(SLOW_BURN, { ...initialInvestigation(SLOW_BURN), tableVisible: 3 });
    expect(partial.rows.map((row) => row.index)).toEqual([0, 1, 2]);
    expect(partial.total).toBe(8);
    expect(partial.hasMore).toBe(true);
    expect(buildTableTwinRows(SLOW_BURN, { ...initialInvestigation(SLOW_BURN), tableVisible: 8 }).hasMore).toBe(false);
  });
});

function signatureLike(stream: AnalysisStream, word: string): string {
  const found = stream.errors.find((group) => group.signature.includes(word));
  if (found === undefined) throw new Error(`no signature with ${word}`);
  return found.signature;
}

const CAMERAS = signatureLike(AMBIGUOUS, 'cameras');
const NOTEBOOKS = signatureLike(AMBIGUOUS, 'notebooks');
const TABLETS = signatureLike(AMBIGUOUS, 'tablets');
const CHECKOUT_SIGNATURE = CHECKOUT.errors[0]?.signature ?? '';

function filtered(stream: AnalysisStream, signature: string | null, index: number): InvestigationState {
  return { ...at(stream, index), filter: signature };
}

describe('buildSignatureRows', () => {
  it('orders signatures by events, first seen, then signature', () => {
    const view = buildSignatureRows(AMBIGUOUS, initialInvestigation(AMBIGUOUS));
    expect(view.emptyText).toBeNull();
    expect(view.rows.map((row) => [row.signature, row.count, row.firstSeen])).toEqual([
      [CAMERAS, 2, '10:06:00'],
      [NOTEBOOKS, 1, '10:05:00'],
      [TABLETS, 1, '10:24:00'],
    ]);
    const first = view.rows[0];
    expect(first?.firstSeenTitle).toBe('2026-10-19 10:06:00 UTC');
    expect(first?.representativeMessage.length).toBeGreaterThan(0);
    expect(view.rows.every((row) => !row.pressed && row.actionLabel === 'Filter timeline')).toBe(true);
  });

  it('marks only the filtered row as pressed with the clearing label', () => {
    const view = buildSignatureRows(AMBIGUOUS, filtered(AMBIGUOUS, CAMERAS, 1));
    expect(view.rows.map((row) => row.pressed)).toEqual([true, false, false]);
    expect(view.rows[0]?.actionLabel).toBe('Filtering — clear');
    expect(view.rows[1]?.actionLabel).toBe('Filter timeline');
  });
});

describe('buildSeries', () => {
  it('returns totals and no filtered series when unfiltered', () => {
    expect(buildSeries(CHECKOUT, null)).toEqual({ totals: [2, 0, 3], filtered: null, yMax: 3 });
  });

  it('returns the filtered series with the axis maximum from the totals', () => {
    expect(buildSeries(CHECKOUT, CHECKOUT_SIGNATURE)).toEqual({ totals: [2, 0, 3], filtered: [2, 0, 3], yMax: 3 });
    expect(buildSeries(AMBIGUOUS, CAMERAS).filtered).toEqual([0, 1, 0, 1, 0]);
    expect(buildSeries(AMBIGUOUS, CAMERAS).yMax).toBe(buildSeries(AMBIGUOUS, null).yMax);
  });

  it('does not rescale for a signature absent from the log', () => {
    expect(buildSeries(CHECKOUT, 'not in this log')).toEqual({ totals: [2, 0, 3], filtered: [0, 0, 0], yMax: 3 });
  });
});

describe('signature filter', () => {
  it('reads the filtered count against the interval total in the readout', () => {
    const readout = buildReadout(AMBIGUOUS, filtered(AMBIGUOUS, CAMERAS, 1));
    expect(readout.text).toBe('10:05–10:10 UTC · 1 of 2 errors · 2 signatures · Inside onset window');
    expect(readout.logButtonLabel).toBe('Show log lines (1)');
  });

  it('shows the interval events of the signature in bucket scope and all of them in signature scope', () => {
    const bucketScope = filtered(AMBIGUOUS, CAMERAS, 1);
    expect(selectLogLines(AMBIGUOUS, bucketScope)).toHaveLength(1);
    const signatureScope: InvestigationState = { ...bucketScope, logPanel: { open: true, visible: LOG_PAGE_SIZE, scope: 'signature' } };
    const events = selectLogLines(AMBIGUOUS, signatureScope);
    expect(events).toHaveLength(2);
    const stamps = events.map((event) => event.timestampUtc);
    expect([...stamps].sort()).toEqual(stamps);
  });

  it('opens a signature-scope panel after set-filter then open-log-lines', () => {
    const context = investigationContext(AMBIGUOUS);
    let state = initialInvestigation(AMBIGUOUS);
    state = reduceInvestigation(state, { type: 'set-filter', signature: CAMERAS }, context);
    state = reduceInvestigation(state, { type: 'open-log-lines', scope: 'signature' }, context);
    expect(state.filter).toBe(CAMERAS);
    expect(state.logPanel).toEqual({ open: true, visible: LOG_PAGE_SIZE, scope: 'signature' });
    expect(selectLogLines(AMBIGUOUS, state)).toHaveLength(2);
  });
});

describe('signature table edge cases', () => {
  it('yields one empty-state message and no rows for a log without error groups', () => {
    const quiet: AnalysisStream = { ...AMBIGUOUS, errors: [] };
    expect(buildSignatureRows(quiet, initialInvestigation(quiet))).toEqual({ rows: [], emptyText: 'No errors in this log' });
  });

  it('names the full date only when first seen is on a different day than the onset window start', () => {
    const sameDay = buildSignatureRows(AMBIGUOUS, initialInvestigation(AMBIGUOUS)).rows;
    expect(sameDay[0]?.accessibleName).toBe(`${CAMERAS}, 2 events, first seen 10:06:00 UTC`);
    expect(sameDay.every((row) => !row.accessibleName.includes('2026-'))).toBe(true);

    const shifted: AnalysisStream = {
      ...AMBIGUOUS,
      errors: AMBIGUOUS.errors.map((group) =>
        group.signature === TABLETS ? { ...group, firstSeenUtc: '2026-10-20T10:24:00.000Z' } : group,
      ),
    };
    const rows = buildSignatureRows(shifted, initialInvestigation(shifted)).rows;
    const tablets = rows.find((row) => row.signature === TABLETS);
    expect(tablets?.accessibleName).toBe(`${TABLETS}, 1 event, first seen 2026-10-20 10:24:00 UTC`);
    expect(tablets?.firstSeen).toBe('10:24:00');
    expect(tablets?.firstSeenTitle).toBe('2026-10-20 10:24:00 UTC');
    expect(rows.find((row) => row.signature === CAMERAS)?.accessibleName).not.toContain('2026-');
  });

  it('compares against the first interval date when there is no onset window', () => {
    const noOnset: AnalysisStream = {
      ...AMBIGUOUS,
      onset: { ...AMBIGUOUS.onset, windowStartUtc: null, windowEndUtc: null },
      errors: AMBIGUOUS.errors.map((group) =>
        group.signature === NOTEBOOKS ? { ...group, firstSeenUtc: '2026-10-18T23:59:00.000Z' } : group,
      ),
    };
    const rows = buildSignatureRows(noOnset, initialInvestigation(noOnset)).rows;
    expect(rows.find((row) => row.signature === NOTEBOOKS)?.accessibleName).toContain('2026-10-18 23:59:00 UTC');
    expect(rows.find((row) => row.signature === CAMERAS)?.accessibleName).not.toContain('2026-');
  });

  it('breaks ties on first seen and then on signature text', () => {
    const tied: AnalysisStream = {
      ...AMBIGUOUS,
      errors: AMBIGUOUS.errors.map((group) => ({ ...group, count: 1, firstSeenUtc: '2026-10-19T10:00:00.000Z' })),
    };
    const order = buildSignatureRows(tied, initialInvestigation(tied)).rows.map((row) => row.signature);
    expect(order).toEqual([CAMERAS, NOTEBOOKS, TABLETS]);
  });
});

describe('filtered data table', () => {
  it('shows filtered error counts and keeps the signature counts', () => {
    const plain = buildTableTwinRows(AMBIGUOUS, initialInvestigation(AMBIGUOUS));
    const view = buildTableTwinRows(AMBIGUOUS, filtered(AMBIGUOUS, CAMERAS, 1));
    expect(view.rows.map((row) => row.errors)).toEqual([0, 1, 0, 1, 0]);
    expect(view.rows.map((row) => row.signatures)).toEqual(plain.rows.map((row) => row.signatures));
    expect(view.rows).toHaveLength(plain.rows.length);
  });

  it('restores the totals when the filter is cleared', () => {
    const cleared = buildTableTwinRows(AMBIGUOUS, filtered(AMBIGUOUS, null, 1));
    expect(cleared.rows.map((row) => row.errors)).toEqual(AMBIGUOUS.timeline.map((point) => point.errorCount));
  });
});

describe('filter scope transitions', () => {
  const context = investigationContext(AMBIGUOUS);

  it('closes a signature-scope panel when the filter is cleared', () => {
    let state = reduceInvestigation(initialInvestigation(AMBIGUOUS), { type: 'set-filter', signature: CAMERAS }, context);
    state = reduceInvestigation(state, { type: 'open-log-lines', scope: 'signature' }, context);
    const cleared = reduceInvestigation(state, { type: 'set-filter', signature: null }, context);
    expect(cleared.filter).toBeNull();
    expect(cleared.logPanel).toEqual({ open: false, visible: LOG_PAGE_SIZE, scope: 'bucket' });
  });

  it('leaves a bucket-scope panel open when the filter is cleared', () => {
    let state = reduceInvestigation(initialInvestigation(AMBIGUOUS), { type: 'set-filter', signature: CAMERAS }, context);
    state = reduceInvestigation(state, { type: 'open-log-lines' }, context);
    const cleared = reduceInvestigation(state, { type: 'set-filter', signature: null }, context);
    expect(cleared.logPanel.open).toBe(true);
    expect(cleared.logPanel.scope).toBe('bucket');
    expect(selectLogLines(AMBIGUOUS, cleared)).toHaveLength(2);
  });

  it('keeps only one signature active and ignores a repeated filter', () => {
    const first = reduceInvestigation(initialInvestigation(AMBIGUOUS), { type: 'set-filter', signature: CAMERAS }, context);
    expect(reduceInvestigation(first, { type: 'set-filter', signature: CAMERAS }, context)).toBe(first);
    const second = reduceInvestigation(first, { type: 'set-filter', signature: NOTEBOOKS }, context);
    expect(second.filter).toBe(NOTEBOOKS);
    const view = buildSignatureRows(AMBIGUOUS, second);
    expect(view.rows.filter((row) => row.pressed).map((row) => row.signature)).toEqual([NOTEBOOKS]);
  });

  it('opens a bucket scope when a signature scope is requested without a filter', () => {
    const state = reduceInvestigation(initialInvestigation(AMBIGUOUS), { type: 'open-log-lines', scope: 'signature' }, context);
    expect(state.logPanel).toEqual({ open: true, visible: LOG_PAGE_SIZE, scope: 'bucket' });
  });

  it('returns a signature-scope panel to the selected interval when the selection moves', () => {
    let state = reduceInvestigation(initialInvestigation(AMBIGUOUS), { type: 'set-filter', signature: CAMERAS }, context);
    state = reduceInvestigation(state, { type: 'open-log-lines', scope: 'signature' }, context);
    state = reduceInvestigation(state, { type: 'select', index: 3 }, context);
    expect(state.logPanel.scope).toBe('bucket');
    expect(state.logPanel.open).toBe(true);
    expect(selectLogLines(AMBIGUOUS, state)).toHaveLength(1);
  });

  it('switches from a bucket-scope panel to the whole signature when asked', () => {
    let state = reduceInvestigation(filtered(AMBIGUOUS, CAMERAS, 1), { type: 'open-log-lines' }, context);
    expect(state.logPanel.scope).toBe('bucket');
    state = reduceInvestigation(state, { type: 'open-log-lines', scope: 'signature' }, context);
    expect(state.logPanel.scope).toBe('signature');
    expect(reduceInvestigation(state, { type: 'open-log-lines', scope: 'signature' }, context)).toBe(state);
  });
});

describe('log panel headings with a filter', () => {
  it('appends the signature to the interval heading in bucket scope', () => {
    const state = { ...filtered(AMBIGUOUS, CAMERAS, 1), logPanel: { open: true, visible: LOG_PAGE_SIZE, scope: 'bucket' as const } };
    const view = buildLogPanelView(AMBIGUOUS, state);
    expect(view.heading).toBe(`Log lines · 10:05–10:10 UTC · 1 event · ${CAMERAS}`);
    expect(view.total).toBe(1);
  });

  it('names the signature and its full event count in signature scope', () => {
    const state = { ...filtered(AMBIGUOUS, CAMERAS, 1), logPanel: { open: true, visible: LOG_PAGE_SIZE, scope: 'signature' as const } };
    const view = buildLogPanelView(AMBIGUOUS, state);
    expect(view.heading).toBe(`Log lines · ${CAMERAS} · 2 events`);
    expect(view.total).toBe(2);
    expect(view.rows).toHaveLength(2);
    expect(view.emptyText).toBeNull();
  });

  it('shows the empty text for an interval without events of the signature', () => {
    const view = buildLogPanelView(AMBIGUOUS, filtered(AMBIGUOUS, CAMERAS, 4));
    expect(view.total).toBe(0);
    expect(view.emptyText).toBe(LOG_EMPTY_TEXT);
  });
});

describe('countForSignature', () => {
  it('reads inherited object names as absent in every checkout interval', () => {
    for (const bucket of CHECKOUT.buckets) {
      for (const name of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf']) {
        expect(countForSignature(bucket, name)).toBe(0);
      }
    }
  });

  it('reads own signature counts', () => {
    expect(CHECKOUT.buckets.map((bucket) => countForSignature(bucket, CHECKOUT_SIGNATURE))).toEqual([2, 0, 3]);
    expect(countForSignature({ signatureCounts: { constructor: 4 } }, 'constructor')).toBe(4);
  });

  it('keeps an inherited-name filter from changing the series or the readout', () => {
    expect(buildSeries(CHECKOUT, 'constructor').filtered).toEqual([0, 0, 0]);
    expect(buildReadout(CHECKOUT, filtered(CHECKOUT, '__proto__', 2)).text).toBe(
      '04:30–04:35 UTC · 0 of 3 errors · 1 signature · Inside onset window',
    );
  });
});
