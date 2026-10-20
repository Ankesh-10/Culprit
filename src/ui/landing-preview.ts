import { patternChip } from './case-picker';
import { findCase, toAnalysisInput } from './cases';
import type { BundledCaseId } from './cases';
import { el, svgEl } from './dom';
import { formatUtcInterval } from './format';
import { prefixIdRefs } from './landing-model';
import { sparklinePath } from './sparkline';
import { renderConfidenceMeter, renderScoreMeter } from './verdict';
import { buildShortlistView, buildVerdictView } from './view-model';
import { handleAnalyzeRequest } from '../worker/protocol';
import type { AnalysisStream } from '../core/model';

/**
 * Builders for the landing previews. Every number and string on a preview comes from the pure core
 * (through the same view-models the console uses) run on the bundled fixtures in this browser; the DOM
 * is built with el()/svgEl() only, so fixture text reaches the page as text nodes and never as markup.
 */

const streams = new Map<BundledCaseId, AnalysisStream | null>();

/** The bundled case analysed once on the main thread; null when the analysis fails for any reason. */
export function bundledStream(id: BundledCaseId): AnalysisStream | null {
  const cached = streams.get(id);
  if (cached !== undefined) return cached;
  let stream: AnalysisStream | null = null;
  try {
    const bundledCase = findCase(id);
    if (bundledCase !== undefined) {
      const response = handleAnalyzeRequest({ type: 'analyze', requestId: 0, input: toAnalysisInput(bundledCase) });
      stream = response.type === 'result' ? response.stream : null;
    }
  } catch {
    stream = null;
  }
  streams.set(id, stream);
  return stream;
}

export interface PreviewFrameOptions {
  label: string;
  caption: string;
  /** One visually hidden sentence built from real values; '' omits it. */
  summary: string;
  body: Node;
  inertBody: boolean;
  className?: string;
}

/** A labelled region holding a caption, an optional screen-reader summary and the preview body. */
export function previewFrame(options: PreviewFrameOptions): HTMLElement {
  const body = el('div', { className: 'preview-body' }, [options.body]);
  if (options.inertBody) body.setAttribute('inert', '');
  const children: HTMLElement[] = [el('p', { className: 'preview-caption', text: options.caption })];
  if (options.summary !== '') children.push(el('p', { className: 'visually-hidden', text: options.summary }));
  children.push(body);
  return el(
    'div',
    {
      className: options.className === undefined ? 'preview-frame' : `preview-frame ${options.className}`,
      attrs: { role: 'region', 'aria-label': options.label },
    },
    children,
  );
}

const ID_REFERENCE_ATTRIBUTES = ['aria-labelledby', 'aria-describedby', 'aria-controls', 'aria-activedescendant', 'for'] as const;
const FOCUS_HOOK_ATTRIBUTES = ['data-suspect-rank', 'data-focus-id', 'data-roll'] as const;

/**
 * Makes a renderer copy safe to sit next to the live console: ids and id references get a prefix so the
 * document keeps unique ids, and the focus hooks the console looks up by attribute are removed. href is
 * left alone because the sprite icons use fragment references that must keep resolving.
 */
export function prepareRendered<T extends Element>(root: T, prefix: string): T {
  const nodes: Element[] = [root, ...Array.from(root.querySelectorAll('*'))];
  for (const node of nodes) {
    const id = node.getAttribute('id');
    if (id !== null && id !== '') node.setAttribute('id', `${prefix}-${id}`);
    for (const name of ID_REFERENCE_ATTRIBUTES) {
      const value = node.getAttribute(name);
      if (value !== null) node.setAttribute(name, prefixIdRefs(value, prefix));
    }
    for (const name of FOCUS_HOOK_ATTRIBUTES) node.removeAttribute(name);
  }
  return root;
}

const SPARKLINE_WIDTH = 120;
const SPARKLINE_HEIGHT = 28;

/** Same structure and classes as the case-card sparkline in the console. */
export function sparklineSvg(counts: readonly number[]): SVGElement | null {
  const path = sparklinePath(counts, SPARKLINE_WIDTH, SPARKLINE_HEIGHT);
  if (path === '') return null;
  return svgEl(
    'svg',
    {
      class: 'sparkline',
      viewBox: `0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`,
      preserveAspectRatio: 'none',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    [svgEl('path', { class: 'sparkline-line', d: path, 'vector-effect': 'non-scaling-stroke' })],
  );
}

/** The onset window as a UTC interval, or null when either end is missing. */
export function onsetWindowText(stream: AnalysisStream): string | null {
  const { windowStartUtc, windowEndUtc } = stream.onset;
  if (windowStartUtc === null || windowEndUtc === null) return null;
  return formatUtcInterval(windowStartUtc, windowEndUtc);
}

const HERO_CASE_NAME = 'Checkout outage';

/** The live result card in the hero: the checkout case, analysed in this browser. Null when there is nothing to show. */
export function renderHeroCard(stream: AnalysisStream): HTMLElement | null {
  const verdict = buildVerdictView(stream);
  const shortlist = buildShortlistView(stream);
  if (verdict === null || shortlist === null) return null;

  const trend: Array<HTMLElement | SVGElement> = [];
  const line = sparklineSvg(stream.timeline.map((point) => point.errorCount));
  if (line !== null) trend.push(el('div', { className: 'hero-sparkline' }, [line]));
  const windowText = onsetWindowText(stream);
  const trendMeta: HTMLElement[] = [el('span', { className: 'chip', text: patternChip(stream.onset.class) })];
  if (windowText !== null) trendMeta.push(el('span', { className: 'hero-window', text: `Onset ${windowText}` }));
  trend.push(el('div', { className: 'hero-trend-meta' }, trendMeta));

  const others = shortlist.rows.slice(1);
  const children: Array<HTMLElement | SVGElement> = [
    el('p', { className: 'hero-card-label', text: verdict.heading }),
    el('p', { className: 'hero-hash', text: verdict.headline.shortSha, attrs: { 'data-roll': 'decode' } }),
    el('p', { className: 'hero-subject', text: verdict.headline.subject }),
    el('div', { className: 'score-line' }, [
      renderScoreMeter(verdict.score.fraction),
      el('span', { className: 'score-value', text: verdict.score.text, attrs: { 'data-roll': 'count' } }),
      el('span', { className: 'score-caption', text: 'rounded for display' }),
    ]),
    renderConfidenceMeter(verdict.confidence),
    el('div', { className: 'hero-trend' }, trend),
  ];
  if (others.length > 0) {
    children.push(
      el(
        'ol',
        { className: 'hero-others', attrs: { 'aria-label': 'Other suspects' } },
        others.map((row) =>
          el('li', {}, [
            el('span', { className: 'hero-other-rank', text: row.rankLabel }),
            el('span', { className: 'hero-other-hash', text: row.shortSha }),
            el('span', { className: 'hero-other-score', text: row.scoreText }),
          ]),
        ),
      ),
    );
  }
  children.push(el('p', { className: 'hero-caveat', text: verdict.caveat }));

  return previewFrame({
    label: `Live preview: ${HERO_CASE_NAME} result`,
    caption: `Live preview · ${HERO_CASE_NAME}, analyzed in this browser`,
    summary: '',
    body: el('div', { className: 'hero-card-body' }, children),
    inertBody: false,
    className: 'hero-card',
  });
}
