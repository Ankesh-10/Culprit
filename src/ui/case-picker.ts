import type { BundledCase } from './cases';
import { clear, el, icon, svgEl } from './dom';
import { sparklinePath } from './sparkline';

const SPARKLINE_WIDTH = 120;
const SPARKLINE_HEIGHT = 28;

const PATTERN_CHIPS: ReadonlyMap<string, string> = new Map([
  ['spike', 'Sharp spike'],
  ['ramp', 'Slow ramp'],
  ['ambiguous', 'Ambiguous'],
]);

export function patternChip(onsetClass: string): string {
  return PATTERN_CHIPS.get(onsetClass) ?? onsetClass;
}

export interface CasePickerOptions {
  cases: readonly BundledCase[];
  loadedId: string | null;
  hasResult: boolean;
  sparklines: ReadonlyMap<string, readonly number[]>;
  onLoad(id: string): void;
  ownFormOpen: boolean;
  onToggleOwn(): void;
}

export const OWN_TOGGLE_ID = 'own-files';
export const OWN_TOGGLE_TEXT = 'Use your own files';

function renderOwnToggle(options: CasePickerOptions): HTMLButtonElement {
  return el('button', {
    className: options.hasResult ? 'case-toggle own-toggle' : 'button-secondary own-toggle',
    text: OWN_TOGGLE_TEXT,
    attrs: {
      type: 'button',
      'aria-expanded': options.ownFormOpen ? 'true' : 'false',
      'aria-controls': 'own-files-form',
      'data-case-id': OWN_TOGGLE_ID,
    },
    on: { click: () => options.onToggleOwn() },
  });
}

function sparkline(counts: readonly number[]): SVGElement | null {
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

function buttonAttrs(bundledCase: BundledCase, loaded: boolean): Record<string, string> {
  return {
    type: 'button',
    'aria-label': `Load ${bundledCase.name}`,
    'aria-pressed': loaded ? 'true' : 'false',
    'data-case-id': bundledCase.id,
  };
}

function renderCard(bundledCase: BundledCase, options: CasePickerOptions): HTMLButtonElement {
  const loaded = options.loadedId === bundledCase.id;
  const heading: Array<Node | string> = [el('span', { className: 'case-name', text: bundledCase.name })];
  if (loaded) heading.push(icon('check', 'icon case-check'));
  const children: Node[] = [el('span', { className: 'case-heading' }, heading)];
  const counts = options.sparklines.get(bundledCase.id);
  const line = counts === undefined ? null : sparkline(counts);
  if (line !== null) children.push(line);
  children.push(
    el('span', { className: 'case-purpose', text: bundledCase.purpose }),
    el('span', { className: 'chip', text: patternChip(bundledCase.onsetClass) }),
  );
  return el(
    'button',
    {
      className: loaded ? 'case-card is-loaded' : 'case-card',
      attrs: buttonAttrs(bundledCase, loaded),
      on: { click: () => options.onLoad(bundledCase.id) },
    },
    children,
  );
}

function renderToggle(bundledCase: BundledCase, options: CasePickerOptions): HTMLButtonElement {
  const loaded = options.loadedId === bundledCase.id;
  const children: Array<Node | string> = [el('span', { className: 'case-name', text: bundledCase.name })];
  if (loaded) children.push(icon('check', 'icon case-check'));
  return el(
    'button',
    {
      className: loaded ? 'case-toggle is-loaded' : 'case-toggle',
      attrs: buttonAttrs(bundledCase, loaded),
      on: { click: () => options.onLoad(bundledCase.id) },
    },
    children,
  );
}

/**
 * Before any result: one card per case with a real error-rate sparkline. After a result: a compact,
 * wrapping row of toggles. Re-rendering keeps keyboard focus on the same case.
 */
export function renderCasePicker(container: HTMLElement, options: CasePickerOptions): void {
  const active = container.ownerDocument.activeElement;
  const focusedId = active !== null && container.contains(active) ? active.getAttribute('data-case-id') : null;

  clear(container);
  container.className = options.hasResult ? 'case-picker is-switcher' : 'case-picker';
  for (const bundledCase of options.cases) {
    container.append(options.hasResult ? renderToggle(bundledCase, options) : renderCard(bundledCase, options));
  }
  container.append(renderOwnToggle(options));

  if (focusedId !== null) {
    for (const child of Array.from(container.children)) {
      if (child.getAttribute('data-case-id') === focusedId) (child as HTMLElement).focus();
    }
  }
}
