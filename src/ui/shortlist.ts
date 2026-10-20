import { el, icon } from './dom';
import { renderScoreMeter } from './verdict';
import { CONSIDERED_PAGE_SIZE, pageConsidered } from './view-model';
import type { ConsideredRow, ShortlistRow, ShortlistView } from './view-model';

const SCORE_CAPTION = 'rounded for display';
const NONE = '\u2014';

export interface ShortlistHandlers {
  /** Open the suspect drawer for a rank; `opener` is the control that asked for it. */
  onInspect(rank: number, opener: HTMLElement): void;
}

function renderCard(row: ShortlistRow, handlers: ShortlistHandlers): HTMLElement {
  const inspect = el('button', {
    className: 'button-secondary',
    text: 'Inspect evidence',
    attrs: { type: 'button', 'data-suspect-rank': String(row.rank), 'aria-label': `Inspect evidence for ${row.rankLabel} ${row.shortSha}` },
  });
  inspect.addEventListener('click', () => handlers.onInspect(row.rank, inspect));

  const heading: Array<HTMLElement | SVGElement> = [
    icon('diamond', row.diamond === 'leading' ? 'icon rank-diamond is-leading' : 'icon rank-diamond is-ranked'),
    el('span', { className: 'rank-label', text: row.rankLabel }),
  ];
  if (row.leading) heading.push(el('span', { className: 'chip leading-tag', text: 'Leading' }));

  return el('li', { className: row.leading ? 'lineup-card is-leading' : 'lineup-card', attrs: { 'data-rank': String(row.rank) } }, [
    el('div', { className: 'lineup-heading' }, heading),
    el('p', { className: 'lineup-hash', text: row.shortSha }),
    el('p', { className: 'lineup-subject', text: row.subject, attrs: { title: row.subject } }),
    el('p', { className: 'lineup-byline', text: row.byline }),
    el('p', { className: 'lineup-gap', text: row.gap }),
    el('div', { className: 'score-line' }, [
      renderScoreMeter(row.scoreFraction),
      el('span', { className: 'score-value', text: row.scoreText }),
      el('span', { className: 'score-caption', text: SCORE_CAPTION }),
    ]),
    el('div', { className: 'lineup-evidence' }, [
      el('span', { className: 'chip', text: row.traceChip }),
      el('span', { className: 'lineup-matches', text: row.matches }),
    ]),
    el('div', { className: 'lineup-actions' }, [inspect]),
  ]);
}

export function renderShortlist(view: ShortlistView, handlers: ShortlistHandlers): HTMLElement {
  const headingId = 'lineup-title';
  return el('section', { className: 'lineup', attrs: { 'aria-labelledby': headingId } }, [
    el('div', { className: 'lineup-title-row' }, [
      el('h2', { text: view.heading, attrs: { id: headingId } }),
      el('span', { className: 'lineup-count', text: view.countText }),
    ]),
    el('ol', { className: 'lineup-list' }, view.rows.map((row) => renderCard(row, handlers))),
  ]);
}

const CONSIDERED_COLUMNS = ['Rank', 'Short hash', 'Subject', 'Status', 'Score', 'Reason'] as const;

function renderConsideredRow(row: ConsideredRow): HTMLElement {
  return el('tr', {}, [
    el('td', { className: 'col-number', text: row.rank }),
    el('td', { className: 'col-mono', text: row.shortSha }),
    el('td', { className: 'col-subject', text: row.subject }),
    el('td', { text: row.status }),
    el('td', { className: 'col-number', text: row.score }),
    el('td', { className: 'col-reason', text: row.reason === '' ? NONE : row.reason }),
  ]);
}

export function renderConsidered(view: { summary: string; rows: readonly ConsideredRow[] }): HTMLElement {
  let visible = CONSIDERED_PAGE_SIZE;
  const first = pageConsidered(view.rows, visible);
  const tbody = el('tbody', {}, first.rows.map(renderConsideredRow));
  const table = el('table', { className: 'considered-table' }, [
    el('thead', {}, [
      el(
        'tr',
        {},
        CONSIDERED_COLUMNS.map((name) => el('th', { text: name, attrs: { scope: 'col' } })),
      ),
    ]),
    tbody,
  ]);
  const scroll = el('div', { className: 'table-scroll', attrs: { role: 'region', 'aria-label': 'Commits considered', tabindex: '0' } }, [table]);
  const details = el('details', { className: 'considered' }, [el('summary', { text: view.summary }), scroll]);
  if (!first.hasMore) return details;

  const count = el('p', { className: 'log-count', text: first.countText ?? '' });
  const more = el('button', {
    className: 'button-secondary',
    text: 'Show next 100',
    attrs: { type: 'button', 'data-focus-id': 'considered-more' },
  });
  more.addEventListener('click', () => {
    const previous = visible;
    visible += CONSIDERED_PAGE_SIZE;
    const page = pageConsidered(view.rows, visible);
    tbody.append(...page.rows.slice(previous).map(renderConsideredRow));
    if (page.hasMore) {
      count.textContent = page.countText ?? '';
      return;
    }
    // The last page is in: drop the count and the button, and keep keyboard focus on the table region.
    count.remove();
    more.remove();
    scroll.focus();
  });
  details.append(count, more);
  return details;
}
