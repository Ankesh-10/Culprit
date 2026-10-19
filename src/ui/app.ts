import { createAnalysisClient } from './analysis-client';
import { BUNDLED_CASES, toAnalysisInput } from './cases';
import type { BundledCase } from './cases';
import { renderCasePicker } from './case-picker';
import { clear, el } from './dom';
import { registerLocalFonts } from './fonts';
import { initialPageState, reducePage, scheduleLoadingBanner } from './state';
import type { PageEvent, PageState, Scheduler, SettledState } from './state';
import { renderEmptyState, renderErrorState, renderLoadingPlaceholder, renderStatePanel, renderStatus } from './status';
import { buildLogPanelView, initialInvestigation, investigationContext, reduceInvestigation } from './investigation-model';
import type { InvestigationEvent, InvestigationState } from './investigation-model';
import { renderLogLines } from './log-lines';
import type { LogLinesPanel } from './log-lines';
import { renderConsidered, renderShortlist } from './shortlist';
import { SLIDER_FOCUS_ID, renderTimeline } from './timeline';
import type { TimelineView } from './timeline';
import { renderVerdict } from './verdict';
import {
  buildConsideredRows,
  buildShortlistView,
  buildStatePanel,
  buildStatusView,
  buildVerdictView,
  deriveResultKind,
} from './view-model';
import { handleAnalyzeRequest } from '../worker/protocol';
import type { AnalysisStream } from '../core/model';

function required<T extends HTMLElement>(doc: Document, id: string): T {
  const node = doc.getElementById(id);
  if (node === null) throw new Error(`Missing required element #${id}`);
  return node as T;
}

const timerScheduler: Scheduler = (callback, delayMs) => {
  const handle = setTimeout(callback, delayMs);
  return () => clearTimeout(handle);
};

export function mountApp(doc: Document): void {
  const picker = required<HTMLElement>(doc, 'case-picker');
  const statusRegion = required<HTMLElement>(doc, 'status-region');
  const resultRegion = required<HTMLElement>(doc, 'result');
  const title = required<HTMLElement>(doc, 'result-title');
  const body = required<HTMLElement>(doc, 'result-body');
  const skipTimeline = required<HTMLElement>(doc, 'skip-timeline');
  const client = createAnalysisClient();
  const sparklines = new Map<string, readonly number[]>();
  registerLocalFonts();

  let state: PageState = initialPageState;
  let requestCounter = 0;
  let cancelBanner: () => void = () => undefined;
  let loadedId: string | null = null;
  let hasResult = false;

  let investigation: InvestigationState | null = null;
  let activeStream: AnalysisStream | null = null;
  let timelineView: TimelineView | null = null;
  let logSlot: HTMLElement | null = null;
  let logPanel: LogLinesPanel | null = null;
  let logOpenerId: string | null = null;

  function disposeInvestigation(): void {
    timelineView?.dispose();
    timelineView = null;
    logSlot = null;
    logPanel = null;
  }

  function renderLogPanel(): void {
    if (logSlot === null || activeStream === null || investigation === null) return;
    clear(logSlot);
    logPanel = null;
    if (!investigation.logPanel.open) return;
    logPanel = renderLogLines(buildLogPanelView(activeStream, investigation), {
      onClose: () => dispatchInvestigation({ type: 'close-log-lines' }, null),
      onShowMore: () => dispatchInvestigation({ type: 'show-more-log-lines' }, null),
    });
    logSlot.append(logPanel.element);
  }

  function dispatchInvestigation(event: InvestigationEvent, openerId: string | null): void {
    if (investigation === null || activeStream === null || timelineView === null) return;
    const previous = investigation;
    const next = reduceInvestigation(previous, event, investigationContext(activeStream));
    if (next === previous) {
      if (event.type === 'open-log-lines') logPanel?.heading.focus();
      return;
    }
    investigation = next;
    timelineView.update(next);
    if (next.logPanel.open) {
      renderLogPanel();
      if (!previous.logPanel.open) {
        logOpenerId = openerId;
        logPanel?.heading.focus();
      } else if (event.type === 'show-more-log-lines') {
        (logPanel?.showMoreButton ?? logPanel?.heading)?.focus();
      }
    } else if (previous.logPanel.open) {
      renderLogPanel();
      const opener = logOpenerId ?? SLIDER_FOCUS_ID;
      if (!timelineView.focusById(opener)) timelineView.focusById(SLIDER_FOCUS_ID);
      logOpenerId = null;
    }
  }

  /** The timeline and its log panel slot; selection state is reset whenever a different result arrives. */
  function mountInvestigation(stream: AnalysisStream): HTMLElement {
    disposeInvestigation();
    if (activeStream !== stream || investigation === null) {
      activeStream = stream;
      investigation = initialInvestigation(stream);
      logOpenerId = null;
    }
    timelineView = renderTimeline(stream, investigation, { onEvent: dispatchInvestigation });
    logSlot = el('div', { className: 'log-slot' });
    renderLogPanel();
    return el('div', { className: 'investigation' }, [timelineView.element, logSlot]);
  }

  function renderSettled(settled: SettledState): HTMLElement {
    disposeInvestigation();
    if (settled.phase === 'error') return renderErrorState(settled.failure);
    const stream = settled.stream;
    const panel = buildStatePanel(stream);
    if (panel !== null) {
      const parts: HTMLElement[] = [renderStatePanel(panel)];
      if (deriveResultKind(stream) === 'no-eligible-commits') parts.push(renderConsidered(buildConsideredRows(stream)));
      parts.push(mountInvestigation(stream));
      return el('div', { className: 'result-stack' }, parts);
    }
    const view = buildVerdictView(stream);
    if (view === null) return el('p', { text: stream.ranking.interpretation });
    const parts: HTMLElement[] = [renderVerdict(view)];
    const shortlist = buildShortlistView(stream);
    if (shortlist !== null) parts.push(renderShortlist(shortlist));
    parts.push(renderConsidered(buildConsideredRows(stream)));
    parts.push(mountInvestigation(stream));
    return el('div', { className: 'result-stack' }, parts);
  }

  function renderPicker(): void {
    renderCasePicker(picker, { cases: BUNDLED_CASES, loadedId, hasResult, sparklines, onLoad: loadById });
  }

  function runWhenIdle(task: () => void): void {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(() => task());
    else setTimeout(task, 0);
  }

  /** Real error-rate sparklines come from the pure core on idle time; a failure just omits that card's line. */
  function computeSparklines(): void {
    for (const bundledCase of BUNDLED_CASES) {
      runWhenIdle(() => {
        try {
          const response = handleAnalyzeRequest({ type: 'analyze', requestId: 0, input: toAnalysisInput(bundledCase) });
          if (response.type !== 'result') return;
          sparklines.set(
            bundledCase.id,
            response.stream.timeline.map((point) => point.errorCount),
          );
          renderPicker();
        } catch {
          // Leave this card without a sparkline; case loading is unaffected.
        }
      });
    }
  }

  function showBody(content: HTMLElement): void {
    clear(body);
    body.append(content);
  }

  function render(previous: PageState): void {
    renderStatus(statusRegion, buildStatusView(state));
    resultRegion.setAttribute('aria-busy', state.phase === 'loading' ? 'true' : 'false');
    resultRegion.classList.toggle('is-stale', state.phase === 'loading' && state.previous !== null);

    if (state.phase === 'loading' && previous.phase === 'loading') return;

    switch (state.phase) {
      case 'idle':
        disposeInvestigation();
        title.hidden = true;
        showBody(renderEmptyState());
        break;
      case 'loading':
        if (state.previous === null) disposeInvestigation();
        showBody(state.previous === null ? renderLoadingPlaceholder() : renderSettled(state.previous));
        break;
      case 'done': {
        if (!hasResult) {
          hasResult = true;
          renderPicker();
        }
        title.hidden = false;
        title.textContent = `Result: ${state.label}`;
        showBody(renderSettled(state));
        title.focus();
        break;
      }
      case 'error': {
        disposeInvestigation();
        title.hidden = true;
        const content = renderErrorState(state.failure);
        showBody(content);
        content.querySelector<HTMLElement>('[tabindex="-1"]')?.focus();
        break;
      }
    }
    skipTimeline.hidden = timelineView === null;
  }

  function dispatch(event: PageEvent): void {
    const previous = state;
    const next = reducePage(state, event);
    if (next === previous) return;
    state = next;
    render(previous);
  }

  function load(bundledCase: BundledCase): void {
    requestCounter += 1;
    const requestId = requestCounter;
    loadedId = bundledCase.id;
    renderPicker();
    cancelBanner();
    dispatch({ type: 'start', requestId, label: bundledCase.name });
    cancelBanner = scheduleLoadingBanner(requestId, timerScheduler, dispatch);
    client.analyze(toAnalysisInput(bundledCase)).then(
      (response) => {
        if (response.type === 'result') dispatch({ type: 'succeeded', requestId, stream: response.stream });
        else dispatch({ type: 'failed', requestId, failure: response.failure });
        if (requestId === requestCounter) cancelBanner();
      },
      (error: unknown) => {
        const detail = error instanceof Error && error.message !== '' ? error.message : 'unknown error';
        dispatch({
          type: 'failed',
          requestId,
          failure: { code: 'INTERNAL_ERROR', message: `Analysis stopped unexpectedly: ${detail}`, diagnostics: [] },
        });
        if (requestId === requestCounter) cancelBanner();
      },
    );
  }

  function loadById(id: string): void {
    const bundledCase = BUNDLED_CASES.find((entry) => entry.id === id);
    if (bundledCase !== undefined) load(bundledCase);
  }

  renderPicker();
  render({ phase: 'idle' });
  computeSparklines();
}
