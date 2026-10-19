import { describe, expect, it } from 'vitest';
import type { AnalysisInput, AnalysisStream } from '../../src/core/model';
import { analyze } from '../../src/core/pipeline';
import { findCase, toAnalysisInput } from '../../src/ui/cases';
import {
  LOG_EMPTY_TEXT,
  LOG_PAGE_SIZE,
  buildLogPanelView,
  buildReadout,
  buildTableTwinRows,
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
    expect(initial.logPanel).toEqual({ open: false, visible: LOG_PAGE_SIZE });
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
    expect(state.logPanel).toEqual({ open: true, visible: LOG_PAGE_SIZE });
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
