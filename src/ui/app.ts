import { createAnalysisClient } from './analysis-client';
import { BUNDLED_CASES, toAnalysisInput } from './cases';
import type { BundledCase } from './cases';
import { renderCasePicker } from './case-picker';
import { clear, el } from './dom';
import { registerLocalFonts } from './fonts';
import { initialPageState, reducePage, scheduleLoadingBanner } from './state';
import type { PageEvent, PageState, Scheduler, SettledState } from './state';
import { renderEmptyState, renderErrorState, renderLoadingPlaceholder, renderStatePanel, renderStatus } from './status';
import { renderConsidered, renderShortlist } from './shortlist';
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

function required<T extends HTMLElement>(doc: Document, id: string): T {
  const node = doc.getElementById(id);
  if (node === null) throw new Error(`Missing required element #${id}`);
  return node as T;
}

const timerScheduler: Scheduler = (callback, delayMs) => {
  const handle = setTimeout(callback, delayMs);
  return () => clearTimeout(handle);
};

function renderSettled(settled: SettledState): HTMLElement {
  if (settled.phase === 'error') return renderErrorState(settled.failure);
  const stream = settled.stream;
  const panel = buildStatePanel(stream);
  if (panel !== null) {
    const parts: HTMLElement[] = [renderStatePanel(panel)];
    if (deriveResultKind(stream) === 'no-eligible-commits') parts.push(renderConsidered(buildConsideredRows(stream)));
    return el('div', { className: 'result-stack' }, parts);
  }
  const view = buildVerdictView(stream);
  if (view === null) return el('p', { text: stream.ranking.interpretation });
  const parts: HTMLElement[] = [renderVerdict(view)];
  const shortlist = buildShortlistView(stream);
  if (shortlist !== null) parts.push(renderShortlist(shortlist));
  parts.push(renderConsidered(buildConsideredRows(stream)));
  return el('div', { className: 'result-stack' }, parts);
}

export function mountApp(doc: Document): void {
  const picker = required<HTMLElement>(doc, 'case-picker');
  const statusRegion = required<HTMLElement>(doc, 'status-region');
  const resultRegion = required<HTMLElement>(doc, 'result');
  const title = required<HTMLElement>(doc, 'result-title');
  const body = required<HTMLElement>(doc, 'result-body');
  const client = createAnalysisClient();
  const sparklines = new Map<string, readonly number[]>();
  registerLocalFonts();

  let state: PageState = initialPageState;
  let requestCounter = 0;
  let cancelBanner: () => void = () => undefined;
  let loadedId: string | null = null;
  let hasResult = false;

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
        title.hidden = true;
        showBody(renderEmptyState());
        break;
      case 'loading':
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
        title.hidden = true;
        const content = renderErrorState(state.failure);
        showBody(content);
        content.querySelector<HTMLElement>('[tabindex="-1"]')?.focus();
        break;
      }
    }
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
