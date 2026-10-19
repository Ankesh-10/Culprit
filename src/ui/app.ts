import { createAnalysisClient } from './analysis-client';
import { BUNDLED_CASES, toAnalysisInput } from './cases';
import type { BundledCase } from './cases';
import { clear, el } from './dom';
import { initialPageState, reducePage, scheduleLoadingBanner } from './state';
import type { PageEvent, PageState, Scheduler, SettledState } from './state';
import { renderEmptyState, renderErrorState, renderLoadingPlaceholder, renderStatePanel, renderStatus } from './status';
import { renderVerdict } from './verdict';
import { buildStatePanel, buildStatusView, buildVerdictView } from './view-model';

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
  const panel = buildStatePanel(settled.stream);
  if (panel !== null) return renderStatePanel(panel);
  const view = buildVerdictView(settled.stream);
  return view === null ? el('p', { text: settled.stream.ranking.interpretation }) : renderVerdict(view);
}

export function mountApp(doc: Document): void {
  const picker = required<HTMLElement>(doc, 'case-picker');
  const statusRegion = required<HTMLElement>(doc, 'status-region');
  const resultRegion = required<HTMLElement>(doc, 'result');
  const title = required<HTMLElement>(doc, 'result-title');
  const body = required<HTMLElement>(doc, 'result-body');
  const buttons = new Map<string, HTMLButtonElement>();
  const client = createAnalysisClient();

  let state: PageState = initialPageState;
  let requestCounter = 0;
  let cancelBanner: () => void = () => undefined;

  function markLoaded(loadedId: string): void {
    for (const [id, button] of buttons) button.setAttribute('aria-pressed', id === loadedId ? 'true' : 'false');
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
    markLoaded(bundledCase.id);
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

  for (const bundledCase of BUNDLED_CASES) {
    const button = el('button', {
      className: 'case-button',
      text: bundledCase.name,
      attrs: { type: 'button', 'aria-label': `Load ${bundledCase.name}`, 'aria-pressed': 'false' },
      on: { click: () => load(bundledCase) },
    });
    buttons.set(bundledCase.id, button);
    picker.append(button);
  }

  render({ phase: 'idle' });
}
