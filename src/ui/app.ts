import { createAnalysisClient } from './analysis-client';
import { BUNDLED_CASES, toAnalysisInput } from './cases';
import type { BundledCase } from './cases';
import { renderCasePicker } from './case-picker';
import { buildPostmortemMarkdown, copyText, markdownLineCount, renderCopyControl } from './copy';
import type { CopyControl } from './copy';
import { clear, el } from './dom';
import { renderOwnFilesForm } from './inputs';
import type { FieldName, OwnFilesForm } from './inputs';
import { buildOwnAnalysisInput, canAnalyze, emptyDraft, resultLabel, sourcesFor } from './intake';
import type { InputSources, OwnInputDraft } from './intake';
import { dismissSuspectDrawer, openSuspectDrawer, updateSuspectDrawer } from './drawer';
import type { DrawerHandlers } from './drawer';
import { buildDrawerView } from './drawer-model';
import { registerLocalFonts } from './fonts';
import { initialCopyFeedback, initialPageState, reduceCopyFeedback, reducePage, scheduleLoadingBanner } from './state';
import type { CopyEvent, CopyFeedback, PageEvent, PageState, Scheduler, SettledState } from './state';
import { renderEmptyState, renderErrorState, renderLoadingPlaceholder, renderStatePanel, renderStatus } from './status';
import {
  buildLogPanelView,
  buildSignatureRows,
  initialInvestigation,
  investigationContext,
  reduceInvestigation,
} from './investigation-model';
import type { InvestigationEvent, InvestigationState } from './investigation-model';
import { renderLogLines } from './log-lines';
import type { LogLinesPanel } from './log-lines';
import { renderConsidered, renderShortlist } from './shortlist';
import { renderSignatures } from './signatures';
import type { SignaturesPanel } from './signatures';
import { SLIDER_FOCUS_ID, renderTimeline } from './timeline';
import type { TimelineView } from './timeline';
import { renderTruncationBanner, renderTrustFooter } from './trust-footer';
import { renderVerdict } from './verdict';
import {
  buildConsideredRows,
  buildShortlistView,
  buildStatePanel,
  buildStatusView,
  buildTrustFooterView,
  buildVerdictView,
  deriveResultKind,
} from './view-model';
import { handleAnalyzeRequest } from '../worker/protocol';
import type { AnalysisInput, AnalysisStream } from '../core/model';

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
  const drawer = required<HTMLDialogElement>(doc, 'suspect-drawer');
  const client = createAnalysisClient();
  drawer.addEventListener('close', () => dispatchCopy({ type: 'reset' }));
  const sparklines = new Map<string, readonly number[]>();
  registerLocalFonts();

  let state: PageState = initialPageState;
  let requestCounter = 0;
  let cancelBanner: () => void = () => undefined;
  let loadedId: string | null = null;
  let hasResult = false;

  // Own-files path: the draft lives only in memory; a failed analysis never clears it.
  let draft: OwnInputDraft = emptyDraft();
  let ownFormOpen = false;
  const requestSources = new Map<number, InputSources>();
  const ownHost = el('div', { className: 'own-files-host', attrs: { id: 'own-files-host' } });
  ownHost.hidden = true;
  picker.after(ownHost);
  const ownForm: OwnFilesForm = renderOwnFilesForm(draft, {
    onDraftChange: (next) => {
      draft = next;
    },
    onAnalyze: () => analyzeOwn(),
    onClear: () => {
      draft = emptyDraft();
      ownForm.sync(draft);
      dispatch({ type: 'cleared' });
    },
  });
  ownHost.append(ownForm.element);

  let investigation: InvestigationState | null = null;
  let activeStream: AnalysisStream | null = null;
  let timelineView: TimelineView | null = null;
  let signaturesView: SignaturesPanel | null = null;
  let logSlot: HTMLElement | null = null;
  let logPanel: LogLinesPanel | null = null;
  let logOpenerId: string | null = null;

  let copyFeedback: CopyFeedback = initialCopyFeedback;
  let copyControl: CopyControl | null = null;

  /** Copy feedback lives until the next result, drawer interaction or copy; there is no timer. */
  function dispatchCopy(event: CopyEvent): void {
    const next = reduceCopyFeedback(copyFeedback, event);
    if (next === copyFeedback) return;
    copyFeedback = next;
    copyControl?.update(next);
  }

  async function copyPostmortem(): Promise<void> {
    const stream = activeStream;
    if (stream === null) return;
    const markdown = buildPostmortemMarkdown(stream);
    const outcome = await copyText(markdown, { clipboard: navigator.clipboard, protocol: location.protocol });
    // A different result may have arrived while the clipboard prompt was open; its feedback is not this one's.
    if (activeStream !== stream) return;
    if (outcome === 'copied') dispatchCopy({ type: 'succeeded', lines: markdownLineCount(markdown) });
    else dispatchCopy({ type: 'fell-back', markdown });
  }

  function createCopyControl(): CopyControl {
    const control = renderCopyControl(copyFeedback, {
      onCopy: () => void copyPostmortem(),
      onHide: () => dispatchCopy({ type: 'hide' }),
    });
    copyControl = control;
    return control;
  }

  const drawerHandlers: DrawerHandlers = {
    onStep: (rank) => {
      dispatchCopy({ type: 'reset' });
      if (activeStream === null) return;
      const view = buildDrawerView(activeStream, rank);
      if (view !== null) updateSuspectDrawer(drawer, view, drawerHandlers);
    },
    onShowLogLines: (signature) => {
      // Leave the drawer without returning focus to its opener: focus belongs to the log panel heading.
      dismissSuspectDrawer(drawer);
      dispatchInvestigation({ type: 'set-filter', signature }, null);
      dispatchInvestigation({ type: 'open-log-lines', scope: 'signature' }, null);
    },
  };

  /** Every opener (verdict, lineup, timeline marker) lands here with the control that was activated. */
  function inspectSuspect(rank: number, opener: HTMLElement | null): void {
    if (activeStream === null) return;
    const view = buildDrawerView(activeStream, rank);
    if (view === null) return;
    dispatchCopy({ type: 'reset' });
    openSuspectDrawer(drawer, view, opener, drawerHandlers, () => title.focus());
  }

  function disposeInvestigation(): void {
    dismissSuspectDrawer(drawer);
    timelineView?.dispose();
    timelineView = null;
    signaturesView = null;
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

  /** Focus a control from the timeline or the signatures table; the slider is the fallback. */
  function focusControl(id: string): void {
    if (timelineView?.focusById(id) === true) return;
    if (signaturesView?.focusById(id) === true) return;
    timelineView?.focusById(SLIDER_FOCUS_ID);
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
    signaturesView?.update(buildSignatureRows(activeStream, next));
    if (next.logPanel.open) {
      renderLogPanel();
      const scopeChanged = event.type === 'open-log-lines' && previous.logPanel.scope !== next.logPanel.scope;
      if (!previous.logPanel.open || scopeChanged) {
        logOpenerId = openerId;
        logPanel?.heading.focus();
      } else if (event.type === 'show-more-log-lines') {
        (logPanel?.showMoreButton ?? logPanel?.heading)?.focus();
      }
    } else if (previous.logPanel.open) {
      renderLogPanel();
      focusControl(logOpenerId ?? SLIDER_FOCUS_ID);
      logOpenerId = null;
    }
    // A control that removed itself (Clear filter) must not strand focus on the page body.
    if (event.type === 'set-filter' && (doc.activeElement === null || doc.activeElement === doc.body)) focusControl(SLIDER_FOCUS_ID);
  }

  /** The timeline and its log panel slot; selection state is reset whenever a different result arrives. */
  function mountInvestigation(stream: AnalysisStream): HTMLElement {
    disposeInvestigation();
    if (activeStream !== stream || investigation === null) {
      activeStream = stream;
      investigation = initialInvestigation(stream);
      logOpenerId = null;
    }
    timelineView = renderTimeline(stream, investigation, { onEvent: dispatchInvestigation, onInspect: inspectSuspect });
    signaturesView = renderSignatures(buildSignatureRows(stream, investigation), { onEvent: dispatchInvestigation });
    logSlot = el('div', { className: 'log-slot' });
    renderLogPanel();
    return el('div', { className: 'investigation' }, [timelineView.element, logSlot, signaturesView.element]);
  }

  /** Every done result ends with the trust footer; a truncated input also gets a banner at the very top. */
  function composeResult(stream: AnalysisStream, parts: HTMLElement[]): HTMLElement {
    const footer = buildTrustFooterView(stream);
    if (footer.truncationBanner !== null) parts.unshift(renderTruncationBanner(footer.truncationBanner));
    parts.push(renderTrustFooter(footer));
    return el('div', { className: 'result-stack' }, parts);
  }

  function renderError(settled: Extract<SettledState, { phase: 'error' }>): HTMLElement {
    const sources = requestSources.get(settled.requestId) ?? { logs: '', history: '' };
    return renderErrorState(settled.failure, sources, { onFix: fixInput });
  }

  /** "Fix input" opens the form if it is collapsed and moves focus to the field that needs fixing. */
  function fixInput(target: FieldName): void {
    setOwnFormOpen(true);
    ownForm.focusField(target);
  }

  function setOwnFormOpen(open: boolean): void {
    ownFormOpen = open;
    ownHost.hidden = !open;
    renderPicker();
  }

  function renderSettled(settled: SettledState): HTMLElement {
    disposeInvestigation();
    if (settled.phase === 'error') return renderError(settled);
    const stream = settled.stream;
    const panel = buildStatePanel(stream);
    if (panel !== null) {
      const parts: HTMLElement[] = [renderStatePanel(panel), el('div', { className: 'copy-under-panel' }, [createCopyControl().element])];
      if (deriveResultKind(stream) === 'no-eligible-commits') parts.push(renderConsidered(buildConsideredRows(stream)));
      parts.push(mountInvestigation(stream));
      return composeResult(stream, parts);
    }
    const view = buildVerdictView(stream);
    if (view === null) return composeResult(stream, [el('p', { text: stream.ranking.interpretation })]);
    const parts: HTMLElement[] = [renderVerdict(view, { onInspect: inspectSuspect }, [createCopyControl().element])];
    const shortlist = buildShortlistView(stream);
    if (shortlist !== null) parts.push(renderShortlist(shortlist, { onInspect: inspectSuspect }));
    parts.push(renderConsidered(buildConsideredRows(stream)));
    parts.push(mountInvestigation(stream));
    return composeResult(stream, parts);
  }

  function renderPicker(): void {
    renderCasePicker(picker, {
      cases: BUNDLED_CASES,
      loadedId,
      hasResult,
      sparklines,
      onLoad: loadById,
      ownFormOpen,
      onToggleOwn: () => setOwnFormOpen(!ownFormOpen),
    });
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
        if (previous.phase !== 'done' || previous.requestId !== state.requestId) dispatchCopy({ type: 'reset' });
        title.hidden = false;
        title.textContent = `Result: ${state.label}`;
        showBody(renderSettled(state));
        title.focus();
        break;
      }
      case 'error': {
        disposeInvestigation();
        title.hidden = true;
        const content = renderError(state);
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

  /** One path for bundled cases and own files: latest request wins, the 150 ms banner applies to both. */
  function runAnalysis(label: string, input: AnalysisInput, sources: InputSources, bundledId: string | null): void {
    requestCounter += 1;
    const requestId = requestCounter;
    requestSources.set(requestId, sources);
    loadedId = bundledId;
    renderPicker();
    cancelBanner();
    dispatch({ type: 'start', requestId, label });
    cancelBanner = scheduleLoadingBanner(requestId, timerScheduler, dispatch);
    client.analyze(input).then(
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

  function load(bundledCase: BundledCase): void {
    runAnalysis(
      bundledCase.name,
      toAnalysisInput(bundledCase),
      { logs: bundledCase.logsSource, history: bundledCase.historySource },
      bundledCase.id,
    );
  }

  function analyzeOwn(): void {
    if (!canAnalyze(draft)) return;
    runAnalysis(resultLabel(draft), buildOwnAnalysisInput(draft), sourcesFor(draft), null);
  }

  function loadById(id: string): void {
    const bundledCase = BUNDLED_CASES.find((entry) => entry.id === id);
    if (bundledCase !== undefined) load(bundledCase);
  }

  renderPicker();
  render({ phase: 'idle' });
  computeSparklines();
}
