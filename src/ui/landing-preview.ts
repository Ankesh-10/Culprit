import { patternChip } from './case-picker';
import { BUNDLED_CASES, findCase, toAnalysisInput } from './cases';
import type { BundledCaseId } from './cases';
import { buildPostmortemMarkdown } from './copy';
import { el, svgEl } from './dom';
import { renderDrawerContent } from './drawer';
import { buildDrawerView } from './drawer-model';
import { formatInteger, formatUtcInterval } from './format';
import { initialInvestigation } from './investigation-model';
import { FEATURE_TABS, markdownExcerpt, prefixIdRefs, weightsText } from './landing-model';
import type { FeatureTabId } from './landing-model';
import { renderShortlist } from './shortlist';
import { sparklinePath } from './sparkline';
import { renderTimeline } from './timeline';
import { renderConfidenceMeter, renderScoreMeter } from './verdict';
import { buildShortlistView, buildVerdictView } from './view-model';
import { handleAnalyzeRequest } from '../worker/protocol';
import { SCORING_V1, SIGNAL_ORDER } from '../core/scoring';
import type { AnalysisStream, SignalName } from '../core/model';

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
  const own = `${prefix}-`;
  for (const node of nodes) {
    const id = node.getAttribute('id');
    if (id !== null && id !== '' && !id.startsWith(own)) node.setAttribute('id', `${own}${id}`);
    for (const name of ID_REFERENCE_ATTRIBUTES) {
      const value = node.getAttribute(name);
      if (value === null) continue;
      const tokens = value.split(/s+/).filter((token) => token !== '');
      node.setAttribute(name, tokens.map((token) => (token.startsWith(own) ? token : prefixIdRefs(token, prefix))).join(' '));
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

// ---------------------------------------------------------------------------------------------------------
// Feature previews: real renderer output for the bundled cases, one per feature tab.
// ---------------------------------------------------------------------------------------------------------

const NO_OP = (): void => undefined;
const CHECKOUT: BundledCaseId = 'checkout-outage';
const CHECKOUT_SOURCE = 'Checkout outage case';
const FIXTURE_CAPTION = 'Live preview · bundled fixtures';

/**
 * Some renderers rebuild parts of their own DOM later (the timeline redraws its chart when its size changes),
 * so the prefixing is re-applied to whatever they add. prepareRendered only sets attributes, so this never loops.
 */
function keepPrepared(root: Element, prefix: string): void {
  if (typeof MutationObserver !== 'function') return;
  new MutationObserver(() => {
    prepareRendered(root, prefix);
  }).observe(root, { childList: true, subtree: true });
}

export interface PreviewPart {
  node: HTMLElement;
  summary: string;
}

/** The suspect lineup, exactly as the console renders it, minus the focus hooks. */
export function lineupPart(stream: AnalysisStream, prefix: string): PreviewPart | null {
  const view = buildShortlistView(stream);
  const leading = view?.rows[0];
  if (view === null || leading === undefined) return null;
  const node = prepareRendered(renderShortlist(view, { onInspect: NO_OP }), prefix);
  return { node, summary: `Suspect lineup: ${view.countText}, led by ${leading.shortSha} with a score of ${leading.scoreText}.` };
}

/** The linked timeline. The view lives as long as the page: its resize observer redraws it when it is shown. */
export function timelinePart(stream: AnalysisStream, prefix: string): PreviewPart {
  const view = renderTimeline(stream, initialInvestigation(stream), { onEvent: NO_OP, onInspect: NO_OP });
  const node = prepareRendered(view.element, prefix);
  keepPrepared(node, prefix);
  const windowText = onsetWindowText(stream);
  const marked = windowText === null ? '' : ` with the onset window ${windowText}`;
  return { node, summary: `Error rate over ${stream.timeline.length} intervals${marked} and ${stream.commits.length} commits on one UTC axis.` };
}

/** The evidence drawer body for the leading suspect, without the previous, next and close controls. */
export function drawerPart(stream: AnalysisStream, prefix: string): PreviewPart | null {
  const view = buildDrawerView(stream, 1);
  if (view === null) return null;
  const node = el('div', { className: 'drawer-preview' });
  node.append(renderDrawerContent(view, { onStep: NO_OP, onShowLogLines: NO_OP }));
  node.querySelector('.drawer-controls')?.remove();
  prepareRendered(node, prefix);
  return { node, summary: `Evidence for ${view.title}: ${view.signals.length} signals and ${view.files.length} changed files.` };
}

const MARKDOWN_PREVIEW_LINES = 14;

/** The first lines of the real Markdown postmortem; each line is a span so the demo can reveal them in turn. */
export function markdownPart(stream: AnalysisStream): PreviewPart {
  const lines = markdownExcerpt(buildPostmortemMarkdown(stream), MARKDOWN_PREVIEW_LINES);
  const pre = el('pre', { className: 'preview-markdown' });
  lines.forEach((line, index) => {
    const span = el('span', { className: 'md-line', text: line });
    span.style.setProperty('--line-index', String(index));
    pre.append(span, '\n');
  });
  return { node: pre, summary: `The first ${lines.length} lines of the Markdown postmortem.` };
}

function onsetRows(): PreviewPart | null {
  const rows: HTMLElement[] = [];
  const summaries: string[] = [];
  for (const bundledCase of BUNDLED_CASES) {
    const stream = bundledStream(bundledCase.id);
    if (stream === null) continue;
    const chip = patternChip(stream.onset.class);
    const windowText = onsetWindowText(stream);
    const line = sparklineSvg(stream.timeline.map((point) => point.errorCount));
    rows.push(
      el('li', { className: 'onset-row' }, [
        el('span', { className: 'onset-case', text: bundledCase.name }),
        el('div', { className: 'onset-spark' }, line === null ? [] : [line]),
        el('span', { className: 'chip', text: chip }),
        el('span', { className: 'onset-window', text: windowText === null ? stream.onset.explanation : `Onset ${windowText}` }),
      ]),
    );
    summaries.push(`${bundledCase.name}: ${chip}`);
  }
  if (rows.length === 0) return null;
  return { node: el('ul', { className: 'onset-rows' }, rows), summary: `Onset shape per bundled case. ${summaries.join('; ')}.` };
}

const SIGNAL_LABELS: Readonly<Record<SignalName, string>> = {
  proximity: 'Proximity',
  'trace-match': 'Trace match',
  novelty: 'Novelty',
  churn: 'Churn',
};

function weightsList(): HTMLElement {
  return el(
    'ul',
    { className: 'weights-list', attrs: { 'aria-label': 'Signal weights' } },
    SIGNAL_ORDER.map((signal) => {
      const weight = SCORING_V1.weights[signal];
      const fill = el('span', { className: 'weight-fill' });
      fill.style.setProperty('--fraction', String(weight));
      return el('li', {}, [
        el('span', { className: 'weight-name', text: SIGNAL_LABELS[signal] }),
        el('span', { className: 'weight-value', text: weight.toFixed(2) }),
        el('span', { className: 'weight-bar', attrs: { 'aria-hidden': 'true' } }, [fill]),
      ]);
    }),
  );
}

function offlineFacts(stream: AnalysisStream): PreviewPart {
  const row = (term: string, value: string): HTMLElement => el('div', { className: 'computed-fact' }, [el('dt', { text: term }), el('dd', { text: value })]);
  const events = formatInteger(stream.normalizedEvents.length);
  const commits = formatInteger(stream.commits.length);
  const shape = patternChip(stream.onset.class);
  const node = el('div', { className: 'computed-facts-block' }, [
    el('p', { className: 'computed-label', text: 'Computed in this browser' }),
    el('dl', { className: 'computed-facts' }, [row('Log events read', events), row('Commits read', commits), row('Onset shape', shape)]),
  ]);
  return { node, summary: `Computed in this browser: ${events} log events and ${commits} commits read, onset shape ${shape}.` };
}

function featureLabel(id: FeatureTabId): string {
  return FEATURE_TABS.find((tab) => tab.id === id)?.label ?? id;
}

/**
 * The preview for one feature tab, or null when its data is unavailable. `prefix` keeps the copied ids unique
 * (the landing passes 'feature'); the frame states that the content comes from the bundled fixtures.
 */
export function renderFeaturePreview(id: FeatureTabId, prefix: string): HTMLElement | null {
  try {
    const own = `${prefix}-${id}`;
    const checkout = bundledStream(CHECKOUT);
    let source = CHECKOUT_SOURCE;
    let part: PreviewPart | null = null;
    let inert = true;
    if (id === 'onset') {
      source = 'three bundled cases';
      part = onsetRows();
      inert = false;
    } else if (checkout === null) {
      return null;
    } else if (id === 'suspects') {
      const lineup = lineupPart(checkout, own);
      if (lineup !== null) {
        part = {
          node: el('div', { className: 'suspects-preview' }, [lineup.node, weightsList()]),
          summary: `${lineup.summary} Weights: ${weightsText(SCORING_V1.weights)}.`,
        };
      }
    } else if (id === 'timeline') {
      part = timelinePart(checkout, own);
    } else if (id === 'drawer') {
      part = drawerPart(checkout, own);
    } else if (id === 'postmortem') {
      part = markdownPart(checkout);
      inert = false;
    } else {
      part = offlineFacts(checkout);
      inert = false;
    }
    if (part === null) return null;
    return previewFrame({
      label: `Preview: ${featureLabel(id)}, rendered from the bundled ${source}`,
      caption: FIXTURE_CAPTION,
      summary: part.summary,
      body: part.node,
      inertBody: inert,
    });
  } catch {
    return null;
  }
}
