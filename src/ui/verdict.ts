import { el, icon } from './dom';
import type { VerdictFact, VerdictView } from './view-model';

const SCORE_CAPTION = 'rounded for display';

export interface VerdictHandlers {
  /** Open the suspect drawer for a rank; `opener` is the control that asked for it. */
  onInspect(rank: number, opener: HTMLElement): void;
}

/** Three-segment meter; filled segments carry the ink fill, the visible words repeat the band. */
export function renderConfidenceMeter(view: VerdictView['confidence']): HTMLElement {
  const segments = [1, 2, 3].map((position) =>
    el('span', { className: position <= view.filled ? 'meter-segment is-filled' : 'meter-segment' }),
  );
  const children: Array<HTMLElement | SVGElement> = [
    el('span', { className: 'confidence-meter', attrs: { role: 'img', 'aria-label': view.ariaLabel } }, segments),
    el('span', { className: 'confidence-text', text: view.text }),
  ];
  if (view.hasLabels) children.push(icon('info', 'icon confidence-info'));
  return el('div', { className: 'confidence' }, children);
}

/** Decorative score track; the numeric value is always shown as text next to it. */
export function renderScoreMeter(fraction: number): HTMLElement {
  const fill = el('span', { className: 'score-fill' });
  fill.style.setProperty('--fraction', String(Math.min(1, Math.max(0, fraction))));
  return el('span', { className: 'score-meter', attrs: { 'aria-hidden': 'true' } }, [fill]);
}

function renderCaution(caution: NonNullable<VerdictView['caution']>): HTMLElement {
  return el('div', { className: 'caution-banner' }, [
    icon('alert-triangle', 'icon caution-icon'),
    el('div', { className: 'caution-body' }, [
      el('p', { className: 'caution-lead', text: caution.lead }),
      el(
        'ul',
        { className: 'chip-list', attrs: { 'aria-label': 'Confidence labels' } },
        caution.chips.map((chip) => el('li', { className: 'chip chip-warning' }, [icon('alert-triangle', 'icon'), chip])),
      ),
    ]),
  ]);
}

function renderHeadline(view: VerdictView): HTMLElement {
  return view.headline.mode === 'suspect'
    ? el('div', { className: 'verdict-headline' }, [
        el('p', { className: 'verdict-hash', text: view.headline.shortSha }),
        el('p', { className: 'verdict-subject', text: view.headline.subject }),
      ])
    : el('div', { className: 'verdict-headline' }, [
        el('p', { className: 'verdict-no-clear', text: 'No clear culprit' }),
        el('div', { className: 'verdict-candidate' }, [
          el('p', { className: 'verdict-candidate-label', text: 'Leading candidate' }),
          el('p', { className: 'verdict-hash', text: view.headline.shortSha }),
          el('p', { className: 'verdict-subject', text: view.headline.subject }),
        ]),
      ]);
}

function renderFactValue(fact: VerdictFact): HTMLElement {
  const classes = fact.mono === true ? 'fact-value is-mono' : 'fact-value';
  if (fact.key === 'files' && fact.values !== undefined && fact.values.length > 0) {
    const lines = fact.values.map((value) => el('span', { className: 'fact-line', text: value }));
    if (fact.moreCount !== undefined && fact.moreCount > 0) {
      lines.push(el('span', { className: 'fact-more', text: `+${fact.moreCount} more` }));
    }
    return el('dd', { className: classes }, lines);
  }
  return el('dd', { className: classes, text: fact.value });
}

function renderFacts(view: VerdictView): HTMLElement {
  const rows: HTMLElement[] = [];
  for (const fact of view.facts) {
    rows.push(el('div', { className: 'fact', attrs: { 'data-fact': fact.key } }, [el('dt', { text: fact.label }), renderFactValue(fact)]));
    if (fact.key === 'matches') {
      rows.push(
        el('div', { className: 'fact', attrs: { 'data-fact': 'trace' } }, [
          el('dt', { text: 'Trace match' }),
          el('dd', { className: 'fact-value' }, [el('span', { className: 'chip', text: view.traceChip })]),
        ]),
      );
    }
  }
  return el('dl', { className: 'facts' }, rows);
}

function renderScoreRow(view: VerdictView): HTMLElement {
  return el('div', { className: 'score-row' }, [
    el('p', { className: 'score-label', text: 'Score' }),
    el('div', { className: 'score-line' }, [
      renderScoreMeter(view.score.fraction),
      el('span', { className: 'score-value', text: view.score.text }),
      el('span', { className: 'score-caption', text: SCORE_CAPTION }),
    ]),
    el('p', { className: 'score-helper', text: view.scoreHelper }),
  ]);
}

function renderEvidencePreview(lines: readonly string[], handlers: VerdictHandlers): HTMLElement | null {
  if (lines.length === 0) return null;
  const seeAll = el('button', {
    className: 'button-secondary see-all-evidence',
    text: 'See all evidence',
    attrs: { type: 'button', 'data-suspect-rank': '1' },
  });
  seeAll.addEventListener('click', () => handlers.onInspect(1, seeAll));
  return el('div', { className: 'evidence-preview' }, [
    el('p', { className: 'verdict-label', text: 'Evidence preview' }),
    el(
      'ul',
      { className: 'evidence-list' },
      lines.map((line) => el('li', { text: line })),
    ),
    seeAll,
  ]);
}

function renderActions(handlers: VerdictHandlers, extra: readonly HTMLElement[]): HTMLElement {
  const inspect = el('button', {
    className: 'button-secondary',
    text: 'Inspect evidence',
    attrs: { type: 'button', 'data-suspect-rank': '1' },
  });
  inspect.addEventListener('click', () => handlers.onInspect(1, inspect));
  return el('div', { className: 'verdict-actions' }, [inspect, ...extra]);
}

/** `extraActions` follow 'Inspect evidence' in the actions row (the copy control). */
export function renderVerdict(view: VerdictView, handlers: VerdictHandlers, extraActions: readonly HTMLElement[] = []): HTMLElement {
  const headingId = 'verdict-title';
  const main: HTMLElement[] = [el('p', { className: 'verdict-interpretation', text: view.interpretation }), renderHeadline(view)];
  const preview = renderEvidencePreview(view.evidencePreview, handlers);
  if (preview !== null) main.push(preview);

  const children: HTMLElement[] = [
    el('div', { className: 'verdict-heading-row' }, [el('h2', { text: view.heading, attrs: { id: headingId } }), renderConfidenceMeter(view.confidence)]),
  ];
  if (view.caution !== null) children.push(renderCaution(view.caution));
  children.push(
    el('div', { className: 'verdict-grid' }, [
      el('div', { className: 'verdict-main' }, main),
      el('div', { className: 'verdict-side' }, [renderFacts(view), renderScoreRow(view)]),
    ]),
    renderActions(handlers, extraActions),
    el('p', { className: 'verdict-caveat', text: view.caveat }),
  );
  return el('section', { className: 'verdict', attrs: { 'aria-labelledby': headingId } }, children);
}
