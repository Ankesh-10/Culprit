import { clear, el, icon } from './dom';
import { DRAWER_CAVEAT } from './drawer-model';
import type { DrawerEvidenceItem, DrawerFile, DrawerSignalRow, DrawerView } from './drawer-model';
import { NO_RANGES_TEXT } from './view-model';
import { renderScoreMeter } from './verdict';

export const DRAWER_TITLE_ID = 'drawer-title';

export interface DrawerHandlers {
  /** Re-render the open drawer for a neighbouring suspect. */
  onStep(rank: number): void;
  /** Close the drawer, filter by this signature and move focus to its log lines. */
  onShowLogLines(signature: string): void;
}

interface DrawerSession {
  opener: HTMLElement | null;
  rank: number;
  /** False when the drawer closes because the reader chose to leave it for the log lines. */
  restoreFocus: boolean;
  fallback: () => void;
}

const sessions = new WeakMap<HTMLDialogElement, DrawerSession>();
const wired = new WeakSet<HTMLDialogElement>();

const SUMMARY_FACTS = ['Author', 'Committed', 'Time gap', 'Trace match', 'Score', 'Full SHA'] as const;

function section(title: string, children: Array<HTMLElement | SVGElement>): HTMLElement {
  return el('section', { className: 'drawer-section' }, [el('h3', { text: title }), ...children]);
}

function navButton(label: string, iconName: string, disabled: boolean, onClick: () => void): HTMLButtonElement {
  const button = el(
    'button',
    { className: 'button-secondary drawer-nav-button', attrs: { type: 'button', 'aria-label': label }, on: { click: onClick } },
    [icon(iconName, 'icon'), el('span', { className: 'drawer-button-label', text: label })],
  );
  button.disabled = disabled;
  return button;
}

function renderHeader(view: DrawerView, handlers: DrawerHandlers, close: () => void): HTMLElement {
  const previous = view.prevRank;
  const next = view.nextRank;
  const closeButton = el(
    'button',
    { className: 'button-secondary drawer-close', attrs: { type: 'button', 'aria-label': 'Close suspect drawer' }, on: { click: close } },
    [icon('close', 'icon')],
  );
  return el('header', { className: 'drawer-header' }, [
    el('div', { className: 'drawer-title-row' }, [
      el('h2', { className: 'drawer-title', text: view.title, attrs: { id: DRAWER_TITLE_ID, tabindex: '-1' } }),
      el('div', { className: 'drawer-controls' }, [
        navButton('Previous suspect', 'chevron-left', previous === null, () => {
          if (previous !== null) handlers.onStep(previous);
        }),
        navButton('Next suspect', 'chevron-right', next === null, () => {
          if (next !== null) handlers.onStep(next);
        }),
        closeButton,
      ]),
    ]),
    el('p', { className: 'drawer-subject', text: view.subject }),
  ]);
}

function renderSummary(view: DrawerView): HTMLElement {
  const { summary } = view;
  const values: Record<(typeof SUMMARY_FACTS)[number], HTMLElement> = {
    Author: el('dd', { text: summary.author }),
    Committed: el('dd', { text: summary.committed }),
    'Time gap': el('dd', { text: summary.gap }),
    'Trace match': el('dd', {}, [el('span', { className: 'chip', text: summary.traceChip })]),
    Score: el('dd', {}, [
      el('span', { className: 'score-line' }, [
        renderScoreMeter(summary.scoreFraction),
        el('span', { className: 'score-value', text: summary.scoreText }),
        el('span', { className: 'score-caption', text: 'rounded for display' }),
      ]),
    ]),
    'Full SHA': el('dd', { className: 'drawer-sha', text: summary.fullSha }),
  };
  return section('Summary', [
    el(
      'dl',
      { className: 'drawer-facts' },
      SUMMARY_FACTS.map((name) => el('div', { className: 'drawer-fact' }, [el('dt', { text: name }), values[name]])),
    ),
  ]);
}

function renderSignal(row: DrawerSignalRow): HTMLElement {
  const fill = el('span', { className: 'contribution-fill' });
  fill.style.setProperty('--fraction', String(row.barFraction));
  return el('li', { className: 'signal-row', attrs: { 'data-signal': row.signal } }, [
    el('p', { className: 'signal-title', text: row.title }),
    el('p', { className: 'signal-math', text: row.math }),
    el('span', { className: 'contribution-bar', attrs: { 'aria-hidden': 'true' } }, [fill]),
    el('p', { className: 'signal-explanation', text: row.explanation }),
  ]);
}

function renderWhy(view: DrawerView): HTMLElement {
  return section('Why it ranks here', [
    el('ul', { className: 'signal-list' }, view.signals.map(renderSignal)),
    el('p', { className: 'signal-total', text: view.total }),
  ]);
}

function renderFile(file: DrawerFile): HTMLElement {
  const ranges =
    file.ranges.length === 0
      ? [el('li', { className: 'range-row', text: NO_RANGES_TEXT })]
      : file.ranges.map((range) => {
          const children: HTMLElement[] = [el('span', { className: 'range-text', text: range.text })];
          if (range.overlap !== null) children.push(el('span', { className: 'chip', text: range.overlap }));
          return el('li', { className: 'range-row' }, children);
        });
  return el('li', { className: 'file-item' }, [
    el('p', { className: 'file-path', text: file.path }),
    el('p', { className: 'file-counts', text: file.counts }),
    el('ul', { className: 'range-list' }, ranges),
  ]);
}

function renderFiles(view: DrawerView): HTMLElement {
  const children: HTMLElement[] =
    view.files.length === 0
      ? [el('p', { className: 'drawer-empty', text: NO_RANGES_TEXT })]
      : [el('ul', { className: 'file-list' }, view.files.map(renderFile))];
  children.push(el('p', { className: 'drawer-diff-note', text: view.diffNote }));
  return section('Changed files and line ranges', children);
}

function renderEvidenceItem(item: DrawerEvidenceItem, handlers: DrawerHandlers): HTMLElement {
  const head: HTMLElement[] = [el('span', { className: 'chip', text: item.typeLabel })];
  if (item.location !== null) head.push(el('span', { className: 'evidence-location', text: item.location }));
  const children: HTMLElement[] = [el('div', { className: 'evidence-head' }, head), el('p', { className: 'evidence-detail', text: item.detail })];
  const action = item.action;
  if (action !== null) {
    children.push(
      el('button', {
        className: 'button-secondary',
        text: 'Show matching log lines',
        attrs: { type: 'button', 'aria-label': `Show matching log lines: ${action.signature}` },
        on: { click: () => handlers.onShowLogLines(action.signature) },
      }),
    );
  }
  return el('li', { className: 'evidence-item' }, children);
}

function renderEvidence(view: DrawerView, handlers: DrawerHandlers): HTMLElement {
  return section('Evidence', [
    el(
      'ul',
      { className: 'evidence-items' },
      view.evidence.map((item) => renderEvidenceItem(item, handlers)),
    ),
  ]);
}

/** Header and sections for one suspect; text reaches the page only as text nodes and attributes. */
export function renderDrawerContent(view: DrawerView, handlers: DrawerHandlers, close: () => void = () => undefined): DocumentFragment {
  const fragment = document.createDocumentFragment();
  fragment.append(
    renderHeader(view, handlers, close),
    el('div', { className: 'drawer-body' }, [
      renderSummary(view),
      renderWhy(view),
      renderFiles(view),
      renderEvidence(view, handlers),
      section('Caveat', [el('p', { className: 'drawer-caveat', text: DRAWER_CAVEAT })]),
    ]),
  );
  return fragment;
}

function restoreFocus(dialog: HTMLDialogElement, session: DrawerSession): void {
  const { opener, rank } = session;
  if (opener !== null && opener.isConnected) {
    opener.focus();
    return;
  }
  // The opener was re-rendered away: find a control for the same suspect, else the result heading.
  const byRank = dialog.ownerDocument.querySelector<HTMLElement>(`[data-suspect-rank="${rank}"]`);
  if (byRank !== null) {
    byRank.focus();
    return;
  }
  session.fallback();
}

function wire(dialog: HTMLDialogElement): void {
  if (wired.has(dialog)) return;
  wired.add(dialog);
  dialog.addEventListener('close', () => {
    if (dialog.open) return;
    const session = sessions.get(dialog);
    sessions.delete(dialog);
    if (session !== undefined && session.restoreFocus) restoreFocus(dialog, session);
  });
  // A click on the backdrop lands on the dialog element itself, never on its content.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
}

function fill(dialog: HTMLDialogElement, view: DrawerView, handlers: DrawerHandlers): void {
  clear(dialog);
  dialog.scrollTop = 0;
  dialog.append(renderDrawerContent(view, handlers, () => dialog.close()));
  dialog.querySelector<HTMLElement>(`#${DRAWER_TITLE_ID}`)?.focus();
}

/**
 * Opens the modal drawer for a suspect. Focus moves to the title; when the dialog closes, focus returns to
 * `opener`, or to a control for the same rank, or to `fallback` when neither exists any more.
 */
export function openSuspectDrawer(
  dialog: HTMLDialogElement,
  view: DrawerView,
  opener: HTMLElement | null,
  handlers: DrawerHandlers,
  fallback: () => void = () => undefined,
): void {
  wire(dialog);
  if (dialog.open) {
    updateSuspectDrawer(dialog, view, handlers);
    return;
  }
  sessions.set(dialog, { opener, rank: view.rank, restoreFocus: true, fallback });
  clear(dialog);
  dialog.append(renderDrawerContent(view, handlers, () => dialog.close()));
  dialog.showModal();
  dialog.querySelector<HTMLElement>(`#${DRAWER_TITLE_ID}`)?.focus();
}

/** Re-renders the open drawer in place (Previous or Next suspect) and puts focus back on its title. */
export function updateSuspectDrawer(dialog: HTMLDialogElement, view: DrawerView, handlers: DrawerHandlers): void {
  const session = sessions.get(dialog);
  if (session !== undefined) session.rank = view.rank;
  fill(dialog, view, handlers);
}

/** Closes the drawer without returning focus to its opener, for actions that move focus elsewhere. */
export function dismissSuspectDrawer(dialog: HTMLDialogElement): void {
  const session = sessions.get(dialog);
  if (session !== undefined) session.restoreFocus = false;
  if (dialog.open) dialog.close();
}
