import { describe, expect, it } from 'vitest';
import type { AnalysisInput, AnalysisStream } from '../../src/core/model';
import { analyze } from '../../src/core/pipeline';
import { toAnalysisInput, findCase } from '../../src/ui/cases';
import {
  LOADING_BANNER_DELAY_MS,
  initialPageState,
  reducePage,
  scheduleLoadingBanner,
} from '../../src/ui/state';
import type { PageEvent, PageState, SettledState } from '../../src/ui/state';
import { EMPTY_STATE, buildStatePanel, buildStatusView, deriveResultKind } from '../../src/ui/view-model';
import { handleAnalyzeRequest } from '../../src/worker/protocol';
import type { AnalysisFailure } from '../../src/worker/protocol';

function bundledStream(id: string): AnalysisStream {
  const found = findCase(id);
  if (found === undefined) throw new Error(`missing case ${id}`);
  const response = handleAnalyzeRequest({ type: 'analyze', requestId: 1, input: toAnalysisInput(found) });
  if (response.type !== 'result') throw new Error('expected a result');
  return response.stream;
}

function historyText(commitTimestamp = '2026-10-19T07:00:00Z'): string {
  return JSON.stringify({
    schemaVersion: 1,
    format: 'culprit-json',
    repository: 'test-service',
    commits: [
      {
        sha: 'a'.repeat(40),
        author: 'Test Author',
        timestamp: commitTimestamp,
        message: 'test change',
        files: [{ path: 'src/test.ts', added: 3, deleted: 1, ranges: [{ start: 1, end: 5 }] }],
      },
    ],
  });
}

function plainInput(text: string, commitTimestamp?: string): AnalysisInput {
  return { logs: { text, format: 'plain-text' }, history: { text: historyText(commitTimestamp), format: 'culprit-json' }, options: null };
}

function errorLine(timestamp: string): string {
  return `${timestamp} error request failed`;
}

function syntheticStream(text: string, commitTimestamp?: string): AnalysisStream {
  const outcome = analyze(plainInput(text, commitTimestamp));
  if (!outcome.ok) throw new Error('synthetic input failed to analyze');
  return outcome.stream;
}

const NO_INCIDENT = syntheticStream(
  [errorLine('2026-10-19T07:00:00Z'), errorLine('2026-10-19T07:05:00Z'), errorLine('2026-10-19T07:10:00Z')].join('\n'),
);
const INSUFFICIENT = syntheticStream([errorLine('2026-10-19T07:00:00Z'), errorLine('2026-10-19T07:05:00Z')].join('\n'));
const NO_ELIGIBLE = syntheticStream(
  [
    errorLine('2026-10-19T07:00:00Z'),
    errorLine('2026-10-19T07:05:00Z'),
    ...Array.from({ length: 4 }, () => errorLine('2026-10-19T07:10:00Z')),
  ].join('\n'),
  '2026-10-19T07:12:00Z',
);

const CHECKOUT = bundledStream('checkout-outage');
const SLOW_BURN = bundledStream('slow-burn');
const AMBIGUOUS = bundledStream('ambiguous');

const FAILURE: AnalysisFailure = { code: 'EMPTY_INPUT', message: 'The log is empty.', diagnostics: [] };

function loading(requestId: number, previous: SettledState | null = null, showBanner = false): PageState {
  return { phase: 'loading', requestId, label: `case ${requestId}`, showBanner, previous };
}

function done(requestId: number): SettledState {
  return { phase: 'done', requestId, label: `case ${requestId}`, stream: CHECKOUT };
}

describe('reducePage', () => {
  it('moves idle to loading without a banner', () => {
    expect(reducePage(initialPageState, { type: 'start', requestId: 1, label: 'case 1' })).toEqual(loading(1));
  });

  it('shows the banner only for the current request', () => {
    const current = loading(1);
    expect(reducePage(current, { type: 'banner-due', requestId: 1 })).toEqual(loading(1, null, true));
    const newer = loading(2);
    expect(reducePage(newer, { type: 'banner-due', requestId: 1 })).toBe(newer);
  });

  it('settles the current request and drops a stale response', () => {
    const next = reducePage(loading(1), { type: 'succeeded', requestId: 1, stream: CHECKOUT });
    expect(next).toEqual(done(1));
    const newer = loading(2);
    expect(reducePage(newer, { type: 'succeeded', requestId: 1, stream: CHECKOUT })).toBe(newer);
    expect(reducePage(newer, { type: 'failed', requestId: 1, failure: FAILURE })).toBe(newer);
  });

  it('keeps the previous result while a new load is running, across several restarts', () => {
    const first = done(1);
    const second = reducePage(first, { type: 'start', requestId: 2, label: 'case 2' });
    expect(second).toEqual(loading(2, first));
    const third = reducePage(second, { type: 'start', requestId: 3, label: 'case 3' });
    expect(third).toEqual(loading(3, first));
  });

  it('turns a failure of the current request into the error state and clears it to idle', () => {
    const failed = reducePage(loading(1), { type: 'failed', requestId: 1, failure: FAILURE });
    expect(failed).toEqual({ phase: 'error', requestId: 1, label: 'case 1', failure: FAILURE });
    expect(reducePage(failed, { type: 'cleared' })).toBe(initialPageState);
  });

  it('ignores clearing a finished or running result', () => {
    const finished = done(1);
    expect(reducePage(finished, { type: 'cleared' })).toBe(finished);
    const running = loading(1);
    expect(reducePage(running, { type: 'cleared' })).toBe(running);
  });
});

describe('scheduleLoadingBanner', () => {
  it('dispatches banner-due for its own request after 150 ms and can be cancelled', () => {
    expect(LOADING_BANNER_DELAY_MS).toBe(150);
    let scheduledDelay = -1;
    let fire: () => void = () => undefined;
    let cancelled = false;
    const dispatched: PageEvent[] = [];
    const cancel = scheduleLoadingBanner(
      4,
      (callback, delayMs) => {
        scheduledDelay = delayMs;
        fire = () => {
          if (!cancelled) callback();
        };
        return () => {
          cancelled = true;
        };
      },
      (event) => dispatched.push(event),
    );
    expect(dispatched).toEqual([]);
    expect(scheduledDelay).toBe(150);
    fire();
    expect(dispatched).toEqual([{ type: 'banner-due', requestId: 4 }]);

    dispatched.length = 0;
    cancel();
    fire();
    expect(dispatched).toEqual([]);
  });
});

describe('deriveResultKind', () => {
  it('classifies the bundled cases', () => {
    expect(deriveResultKind(CHECKOUT)).toBe('completed');
    expect(deriveResultKind(SLOW_BURN)).toBe('completed');
    expect(deriveResultKind(AMBIGUOUS)).toBe('low-confidence');
  });

  it('classifies the synthetic no-suspect recipes after asserting their preconditions', () => {
    expect(NO_INCIDENT.onset.class).toBe('none');
    expect(deriveResultKind(NO_INCIDENT)).toBe('no-incident');
    expect(INSUFFICIENT.onset.class).toBe('insufficient-data');
    expect(deriveResultKind(INSUFFICIENT)).toBe('insufficient-data');
    expect(NO_ELIGIBLE.onset.class).toBe('spike');
    expect(NO_ELIGIBLE.ranking.status).toBe('no-eligible-commits');
    expect(deriveResultKind(NO_ELIGIBLE)).toBe('no-eligible-commits');
  });
});

describe('buildStatusView', () => {
  it('describes idle, quick loading, slow loading and error', () => {
    expect(buildStatusView(initialPageState)).toMatchObject({ icon: 'info', tone: 'neutral', label: 'Ready — no incident loaded' });
    expect(buildStatusView(loading(1))).toMatchObject({ label: null, announcement: 'Analyzing incident.' });
    expect(buildStatusView(loading(1, null, true))).toMatchObject({
      icon: 'loader',
      tone: 'neutral',
      label: 'Analyzing locally...',
    });
    const failed = reducePage(loading(1), { type: 'failed', requestId: 1, failure: FAILURE });
    expect(buildStatusView(failed)).toMatchObject({
      icon: 'x-circle',
      tone: 'critical',
      label: "We couldn't analyze these inputs",
    });
  });

  function settled(stream: AnalysisStream): PageState {
    return { phase: 'done', requestId: 1, label: 'x', stream };
  }

  it('announces the checkout result as complete with the top suspect', () => {
    expect(buildStatusView(settled(CHECKOUT))).toEqual({
      icon: 'check-circle',
      tone: 'good',
      label: 'Analysis complete',
      announcement: 'Analysis complete. Top suspect 2222222, high ranking confidence.',
      warningChip: null,
    });
  });

  it('announces the ambiguous result as a lead, with its warning count', () => {
    expect(buildStatusView(settled(AMBIGUOUS))).toEqual({
      icon: 'alert-triangle',
      tone: 'warning',
      label: 'Low confidence — treat as leads, not a diagnosis',
      announcement:
        'Analysis complete with low ranking confidence. Leading candidate 9999999; treat it as a lead, not a diagnosis.',
      warningChip: '1 warning',
    });
  });

  it('uses neutral icons for no-incident and insufficient-data, and a warning icon for no eligible commits', () => {
    expect(buildStatusView(settled(NO_INCIDENT))).toMatchObject({ icon: 'info', tone: 'neutral', label: 'No incident detected' });
    expect(buildStatusView(settled(INSUFFICIENT))).toMatchObject({
      icon: 'info',
      tone: 'neutral',
      label: 'Not enough data to find an onset',
    });
    expect(buildStatusView(settled(NO_ELIGIBLE))).toMatchObject({
      icon: 'alert-triangle',
      tone: 'warning',
      label: 'No commits before the onset',
    });
  });
});

describe('buildStatePanel', () => {
  it('returns the specified panel text for the three no-suspect kinds', () => {
    expect(buildStatePanel(NO_INCIDENT)).toEqual({
      heading: 'No incident detected',
      body: "The log shows no sustained rise in errors, so there is no onset to trace back from. Culprit doesn't rank commits without one. Check that your log covers the failure window.",
    });
    expect(buildStatePanel(INSUFFICIENT)).toEqual({
      heading: 'Not enough data to find an onset.',
      body: 'The log has too few errors or too short a time span. Add more of the log from before and during the failure.',
    });
    expect(buildStatePanel(NO_ELIGIBLE)).toEqual({
      heading: 'No commits before the onset.',
      body: 'Every supplied commit landed after the onset window started, so none can be ranked as a suspect. Add earlier history to compare.',
    });
  });

  it('returns null when there is a verdict to show', () => {
    expect(buildStatePanel(CHECKOUT)).toBeNull();
    expect(buildStatePanel(AMBIGUOUS)).toBeNull();
  });

  it('defines the empty state copy', () => {
    expect(EMPTY_STATE.heading).toBe('Load an incident to see which commits to check first');
    expect(EMPTY_STATE.body).toContain('Everything stays in this browser.');
  });
});

describe('wording discipline', () => {
  const banned = /\bcaused\b|root cause|culprit found|broke production|\d\s*%/i;

  it('keeps causal and probability language out of every status and panel string', () => {
    const streams = [CHECKOUT, SLOW_BURN, AMBIGUOUS, NO_INCIDENT, INSUFFICIENT, NO_ELIGIBLE];
    const strings: string[] = [EMPTY_STATE.heading, EMPTY_STATE.body];
    for (const stream of streams) {
      const view = buildStatusView({ phase: 'done', requestId: 1, label: 'x', stream });
      strings.push(view.announcement);
      if (view.label !== null) strings.push(view.label);
      if (view.warningChip !== null) strings.push(view.warningChip);
      const panel = buildStatePanel(stream);
      if (panel !== null) strings.push(panel.heading, panel.body);
    }
    for (const text of strings) expect(text).not.toMatch(banned);
  });
});
