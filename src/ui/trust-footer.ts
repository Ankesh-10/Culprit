import { el, icon } from './dom';
import type { TrustFooterItem, TrustFooterView } from './view-model';

const HEADING_ID = 'trust-footer-title';
export const NO_WARNINGS_TEXT = 'No warnings or diagnostics were reported.';

function renderItem(item: TrustFooterItem): HTMLElement {
  const children: Array<HTMLElement | SVGElement> = [icon('alert-triangle', 'icon trust-item-icon')];
  if (item.code !== null) children.push(el('span', { className: 'trust-code', text: item.code }));
  if (item.line !== null) children.push(el('span', { className: 'trust-line', text: item.line }));
  children.push(el('span', { className: 'trust-message', text: item.message }));
  return el('li', { className: 'trust-item' }, children);
}

function renderDetail(label: string, content: HTMLElement): HTMLElement {
  return el('div', { className: 'trust-detail' }, [el('h3', { className: 'trust-detail-label', text: label }), content]);
}

function renderAssumptions(view: TrustFooterView): HTMLElement {
  const summary = el('summary', { className: 'trust-summary' }, [
    el('span', { className: 'trust-summary-title', text: 'Assumptions and caveats' }),
    el('span', { className: 'trust-summary-note', text: view.assumptionsSummary }),
  ]);
  const body = el('div', { className: 'trust-details-body' }, [
    renderDetail('Confidence rationale', el('p', { text: view.rationale })),
    renderDetail('Assumptions', el('ul', { className: 'trust-bullets' }, view.assumptions.map((text) => el('li', { text })))),
    renderDetail('Versions', el('p', { className: 'is-mono', text: view.versions })),
    renderDetail('Provenance', el('ul', { className: 'trust-bullets is-mono' }, view.provenance.map((text) => el('li', { text })))),
    renderDetail('Limits', el('p', { text: view.limits })),
    renderDetail('Time zone', el('p', { text: view.utcNote })),
  ]);
  return el('details', { className: 'trust-details' }, [summary, body]);
}

/** Every warning, diagnostic and assumption stays beside the result; the disclosure is closed but its summary says what is inside. */
export function renderTrustFooter(view: TrustFooterView): HTMLElement {
  const head: HTMLElement[] = [el('h2', { text: view.heading, attrs: { id: HEADING_ID } })];
  if (view.countChip !== null) {
    head.push(el('span', { className: 'chip chip-warning' }, [icon('alert-triangle', 'icon'), view.countChip]));
  }
  const list =
    view.items.length === 0
      ? el('p', { className: 'trust-none', text: NO_WARNINGS_TEXT })
      : el('ul', { className: 'trust-list' }, view.items.map(renderItem));
  return el('footer', { className: 'trust-footer', attrs: { 'aria-labelledby': HEADING_ID } }, [
    el('div', { className: 'trust-footer-head' }, head),
    list,
    renderAssumptions(view),
  ]);
}

/** Warning banner shown at the top of the result region when the input hit a limit. */
export function renderTruncationBanner(text: string): HTMLElement {
  return el('div', { className: 'caution-banner truncation-banner' }, [
    icon('alert-triangle', 'icon caution-icon'),
    el('div', { className: 'caution-body' }, [el('p', { className: 'caution-lead', text })]),
  ]);
}
