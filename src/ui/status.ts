import type { AnalysisFailure } from '../worker/protocol';
import { clear, el, icon } from './dom';
import { EMPTY_STATE, LOADING_LABEL, buildErrorSummary } from './view-model';
import type { StatePanel, StatusView } from './view-model';

function childByClass(container: HTMLElement, className: string, tag: 'div' | 'p', attrs: Record<string, string>, extraClass = ''): HTMLElement {
  const existing = container.querySelector<HTMLElement>(`.${className}`);
  if (existing !== null) return existing;
  const created = el(tag, { className: extraClass === '' ? className : `${className} ${extraClass}`, attrs });
  container.append(created);
  return created;
}

/**
 * Renders the visible banner and the polite announcer. The banner sits outside the live region so a
 * state change is announced once, through the announcer, and only when its text actually changes.
 */
export function renderStatus(container: HTMLElement, view: StatusView): void {
  const banner = childByClass(container, 'status-banner', 'div', {});
  const announcer = childByClass(container, 'status-announcer', 'p', {
    role: 'status',
    'aria-live': 'polite',
    'aria-atomic': 'true',
  }, 'visually-hidden');

  clear(banner);
  banner.className = `status-banner tone-${view.tone}`;
  banner.hidden = view.label === null;
  if (view.label !== null) {
    const spin = view.icon === 'loader' ? 'icon icon-spin' : 'icon';
    banner.append(icon(view.icon, spin), el('span', { className: 'status-label', text: view.label }));
    if (view.warningChip !== null) {
      banner.append(el('span', { className: 'chip chip-warning' }, [icon('alert-triangle', 'icon'), view.warningChip]));
    }
  }

  if (announcer.textContent !== view.announcement) announcer.textContent = view.announcement;
}

export function renderStatePanel(panel: StatePanel): HTMLElement {
  return el('section', { className: 'state-panel' }, [
    el('h3', { className: 'state-heading', text: panel.heading, attrs: { tabindex: '-1' } }),
    el('p', { className: 'state-body', text: panel.body }),
  ]);
}

export function renderEmptyState(): HTMLElement {
  return el('section', { className: 'state-panel state-empty' }, [
    el('h3', { className: 'state-heading', text: EMPTY_STATE.heading }),
    el('p', { className: 'state-body', text: EMPTY_STATE.body }),
  ]);
}

/** Text only: no skeleton shapes. */
export function renderLoadingPlaceholder(): HTMLElement {
  return el('div', { className: 'loading-placeholder' }, [el('p', { text: LOADING_LABEL })]);
}

export interface ErrorStateHandlers {
  /** A "Fix input" link was activated for this field. */
  onFix(target: 'log' | 'history'): void;
}

const FIX_LABEL: Record<'log' | 'history', string> = { log: 'Log', history: 'Git history' };

/** The mapped error summary: heading (focus target), generic body, one entry per problem. */
export function renderErrorState(
  failure: AnalysisFailure,
  sources: { logs: string; history: string },
  handlers: ErrorStateHandlers,
): HTMLElement {
  const summary = buildErrorSummary(failure, sources);
  const items = summary.entries.map((entry) => {
    const children: Array<Node | string> = [icon('x-circle', 'icon problem-icon'), el('span', { className: 'problem-text', text: entry.text })];
    const target = entry.fixTarget;
    if (target !== null) {
      children.push(
        el('a', {
          className: 'fix-link',
          text: 'Fix input',
          attrs: { href: `#own-${target}-field`, 'aria-label': `Fix input: ${FIX_LABEL[target]}` },
          on: {
            click: (event) => {
              event.preventDefault();
              handlers.onFix(target);
            },
          },
        }),
      );
    }
    return el('li', { className: 'problem-item' }, children);
  });
  const parts: HTMLElement[] = [
    el('h3', { className: 'state-heading', text: summary.heading, attrs: { tabindex: '-1' } }),
    el('p', { className: 'state-body', text: summary.body }),
    el('ul', { className: 'problem-list' }, items),
  ];
  if (summary.moreText !== null) parts.push(el('p', { className: 'problem-more', text: summary.moreText }));
  return el('section', { className: 'state-panel state-error', attrs: { role: 'alert' } }, parts);
}
