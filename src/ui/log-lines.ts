import { el } from './dom';
import type { LogPanelView, LogRow } from './investigation-model';

export interface LogLinesHandlers {
  onClose(): void;
  onShowMore(): void;
}

export interface LogLinesPanel {
  element: HTMLElement;
  /** The heading takes focus when the panel opens. */
  heading: HTMLElement;
  showMoreButton: HTMLElement | null;
}

const COLUMNS = ['Line', 'Time (UTC)', 'Level', 'Message', 'Stack'] as const;
const NONE = '—';

function renderRow(row: LogRow): HTMLElement {
  const stack =
    row.stack === null
      ? el('span', { text: NONE })
      : el('details', { className: 'log-stack' }, [
          el('summary', { text: 'Stack' }),
          el('pre', { className: 'log-stack-text', text: row.stack }),
        ]);
  return el('tr', {}, [
    el('td', { className: 'col-number', text: row.line }),
    el('td', { className: 'col-mono col-number', text: row.time }),
    el('td', {}, [el('span', { className: 'chip level-chip', text: row.level })]),
    el('td', { className: 'log-message', text: row.message }),
    el('td', { className: 'log-stack-cell' }, [stack]),
  ]);
}

/** The panel is plain text throughout: messages and stacks are written as text nodes only. */
export function renderLogLines(view: LogPanelView, handlers: LogLinesHandlers): LogLinesPanel {
  const headingId = 'log-lines-title';
  const heading = el('h2', { text: view.heading, attrs: { id: headingId, tabindex: '-1' } });
  const close = el('button', {
    className: 'button-secondary',
    text: 'Close log lines',
    attrs: { type: 'button' },
    on: { click: () => handlers.onClose() },
  });

  const children: HTMLElement[] = [el('div', { className: 'log-lines-header' }, [heading, close])];

  if (view.emptyText !== null) {
    children.push(el('p', { className: 'log-empty', text: view.emptyText }));
  } else {
    const table = el('table', { className: 'log-table' }, [
      el('thead', {}, [
        el(
          'tr',
          {},
          COLUMNS.map((name) => el('th', { text: name, attrs: { scope: 'col' } })),
        ),
      ]),
      el('tbody', {}, view.rows.map(renderRow)),
    ]);
    children.push(el('div', { className: 'table-scroll', attrs: { role: 'region', 'aria-label': 'Log lines', tabindex: '0' } }, [table]));
    children.push(
      el('p', {
        className: 'log-count',
        text: `Showing ${view.rows.length} of ${view.total}`,
      }),
    );
  }

  let showMoreButton: HTMLElement | null = null;
  if (view.hasMore) {
    showMoreButton = el('button', {
      className: 'button-secondary',
      text: 'Show next 100',
      attrs: { type: 'button' },
      on: { click: () => handlers.onShowMore() },
    });
    children.push(showMoreButton);
  }

  const element = el('section', { className: 'panel log-lines', attrs: { 'aria-labelledby': headingId } }, children);
  return { element, heading, showMoreButton };
}
