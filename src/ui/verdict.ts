import { el } from './dom';
import type { VerdictView } from './view-model';

export function renderVerdict(view: VerdictView): HTMLElement {
  const headingId = 'verdict-title';
  const headline =
    view.headline.mode === 'suspect'
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

  return el('section', { className: 'verdict', attrs: { 'aria-labelledby': headingId } }, [
    el('h2', { text: view.heading, attrs: { id: headingId } }),
    el('p', { className: 'verdict-confidence', text: view.confidence.text }),
    el('p', { className: 'verdict-interpretation', text: view.interpretation }),
    headline,
    el('p', { className: 'verdict-caveat', text: view.caveat }),
  ]);
}
