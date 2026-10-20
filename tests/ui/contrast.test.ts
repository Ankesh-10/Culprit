import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../src/styles.css', import.meta.url), 'utf8');
const rootBlock = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';

/** The UI-SPEC hex contract (Raycast dark system). */
const SPEC: Record<string, string> = {
  'color-page': '#07080a',
  'color-surface': '#0d0d0d',
  'color-elevated': '#101111',
  'color-raised': '#121212',
  'color-ink': '#f4f4f6',
  'color-ink-2': '#cdcdcd',
  'color-muted': '#9c9c9d',
  'color-border': '#242728',
  'color-control-border': '#6a6b6c',
  'color-grid': '#242728',
  'color-axis': '#434345',
  'color-primary': '#ffffff',
  'color-primary-pressed': '#e8e8e8',
  'color-on-primary': '#000000',
  'color-focus': '#57c1ff',
  'color-good': '#59d499',
  'color-warning': '#ffc533',
  'color-serious': '#ec835a',
  'color-critical': '#ff6161',
  'viz-series-errors': '#3987e5',
  'viz-onset': '#d95926',
  'viz-suspect': '#199e70',
  'viz-context': '#8fa0b8',
};

function token(name: string): string | undefined {
  // Name-exact: the lookbehind stops "--color-ink" from matching inside "--color-ink-2".
  const match = new RegExp(`(?<![\\w-])--${name}\\s*:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(rootBlock);
  return match?.[1]?.toLowerCase();
}

function value(name: string): string {
  const found = token(name);
  if (found === undefined) throw new Error(`--${name} is missing from :root in src/styles.css`);
  return found;
}

/** Reads a `--name: rgba(r, g, b, a);` declaration from the :root block. */
function rgbaToken(name: string): [number, number, number, number] {
  const match = new RegExp(
    `(?<![\\w-])--${name}\\s*:\\s*rgba\\(\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*(\\d+)\\s*,\\s*([0-9.]+)\\s*\\)\\s*;`,
  ).exec(rootBlock);
  if (match === null) throw new Error(`--${name} is missing from :root in src/styles.css`);
  return [Number(match[1]), Number(match[2]), Number(match[3]), Number(match[4])];
}

/** Alpha-blends an rgba colour over a hex background; each channel is rounded to an integer. */
function composite(rgba: [number, number, number, number], backgroundHex: string): string {
  const [r, g, b, a] = rgba;
  const mix = (top: number, offset: number): string => {
    const bottom = Number.parseInt(backgroundHex.slice(offset, offset + 2), 16);
    const blended = Math.round(top * a + bottom * (1 - a));
    return blended.toString(16).padStart(2, '0');
  };
  return `#${mix(r, 1)}${mix(g, 3)}${mix(b, 5)}`;
}

function channel(hex: string, offset: number): number {
  const normalised = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return normalised <= 0.03928 ? normalised / 12.92 : ((normalised + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  return 0.2126 * channel(hex, 1) + 0.7152 * channel(hex, 3) + 0.0722 * channel(hex, 5);
}

function ratio(foreground: string, background: string): number {
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const BACKGROUNDS = ['color-page', 'color-surface', 'color-elevated', 'color-raised'] as const;

describe('shipped colour tokens', () => {
  it.each(Object.entries(SPEC))('--%s equals the UI-SPEC value %s', (name, hex) => {
    expect(token(name)).toBe(hex);
  });
});

describe('WCAG contrast of the shipped tokens', () => {
  it('keeps every text colour at 4.5:1 or better on page, surface, elevated and raised', () => {
    const failures: string[] = [];
    for (const foreground of ['color-ink', 'color-ink-2', 'color-muted']) {
      for (const background of BACKGROUNDS) {
        const result = ratio(value(foreground), value(background));
        if (result < 4.5) failures.push(`${foreground} on ${background}: ${round2(result)}`);
      }
    }
    for (const background of ['color-primary', 'color-primary-pressed']) {
      const onPrimary = ratio(value('color-on-primary'), value(background));
      if (onPrimary < 4.5) failures.push(`color-on-primary on ${background}: ${round2(onPrimary)}`);
    }
    const soft = rgbaToken('color-warning-soft');
    for (const background of ['color-surface', 'color-raised']) {
      const tinted = composite(soft, value(background));
      const result = ratio(value('color-warning'), tinted);
      if (result < 4.5) failures.push(`color-warning on warning-soft over ${background}: ${round2(result)}`);
    }
    expect(failures).toEqual([]);
  });

  it('keeps focus rings, control borders, status icons and chart marks at 3:1 or better', () => {
    const failures: string[] = [];
    const nonText = [
      'color-focus',
      'color-control-border',
      'color-good',
      'color-warning',
      'color-serious',
      'color-critical',
    ];
    for (const foreground of nonText) {
      for (const background of BACKGROUNDS) {
        const result = ratio(value(foreground), value(background));
        if (result < 3) failures.push(`${foreground} on ${background}: ${round2(result)}`);
      }
    }
    for (const foreground of ['viz-series-errors', 'viz-onset', 'viz-suspect', 'viz-context']) {
      for (const background of ['color-page', 'color-surface']) {
        const result = ratio(value(foreground), value(background));
        if (result < 3) failures.push(`${foreground} on ${background}: ${round2(result)}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('matches the figures recorded in the UI-SPEC', () => {
    const pinned: Array<[string, string, number]> = [
      ['color-ink', 'color-surface', 17.69],
      ['color-ink-2', 'color-surface', 12.23],
      ['color-muted', 'color-surface', 7.09],
      ['color-muted', 'color-raised', 6.83],
      ['color-focus', 'color-surface', 9.7],
      ['color-focus', 'color-page', 10],
      ['color-control-border', 'color-surface', 3.64],
      ['color-control-border', 'color-raised', 3.51],
      ['color-good', 'color-surface', 10.46],
      ['color-warning', 'color-surface', 12.3],
      ['color-serious', 'color-surface', 7.37],
      ['color-critical', 'color-surface', 6.6],
      ['color-critical', 'color-raised', 6.36],
      ['viz-series-errors', 'color-surface', 5.34],
      ['viz-onset', 'color-surface', 5],
      ['viz-suspect', 'color-surface', 5.71],
      ['viz-context', 'color-surface', 7.3],
      ['color-on-primary', 'color-primary', 21],
      ['color-on-primary', 'color-primary-pressed', 17.14],
    ];
    const actual = pinned.map(([foreground, background]) => round2(ratio(value(foreground), value(background))));
    expect(actual).toEqual(pinned.map((entry) => entry[2]));

    const soft = rgbaToken('color-warning-soft');
    expect(round2(ratio(value('color-warning'), composite(soft, value('color-surface'))))).toBe(9.12);
    expect(round2(ratio(value('color-warning'), composite(soft, value('color-raised'))))).toBe(8.6);
  });
});

describe('Raycast design rules', () => {
  const afterRoot = css.slice(css.indexOf('}', css.indexOf(':root')) + 1);

  it('uses no gradient anywhere (D-04)', () => {
    expect(css).not.toMatch(/gradient\(/);
  });

  it('uses no backdrop-filter, so there is no glass (D-04)', () => {
    expect(css).not.toContain('backdrop-filter');
  });

  it('only uses inset box-shadow: elevation comes from the surface ladder (D-01)', () => {
    const shadows = [...css.matchAll(/box-shadow\s*:\s*([^;]+);/g)].map((match) => (match[1] ?? '').trim());
    for (const shadow of shadows) expect(shadow.startsWith('inset')).toBe(true);
  });

  it('uses font weights 400 and 500 only (D-03)', () => {
    const weights = [...css.matchAll(/font-weight\s*:\s*([^;]+);/g)].map((match) => (match[1] ?? '').trim());
    const allowed = ['var(--weight-regular)', 'var(--weight-medium)', '400', '500'];
    for (const weight of weights) expect(allowed).toContain(weight);
    expect(rootBlock).toMatch(/--weight-medium\s*:\s*500\s*;/);
    expect(rootBlock).toMatch(/--weight-regular\s*:\s*400\s*;/);
  });

  it('enables calt, kern, liga and ss03 on the body (D-03)', () => {
    const body = /(?:^|\n)body\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    const features = /font-feature-settings\s*:\s*([^;]+);/.exec(body)?.[1] ?? '';
    for (const feature of ['"calt"', '"kern"', '"liga"', '"ss03"']) expect(features).toContain(feature);
  });

  it('puts Inter first in the interface font stack (D-03)', () => {
    const stack = /--font-ui\s*:\s*([^;]+);/.exec(rootBlock)?.[1] ?? '';
    expect(stack.trim().startsWith('Inter')).toBe(true);
  });

  it('retires the sky-blue accent, the destructive fill and the semibold weight (D-02, D-06)', () => {
    for (const retired of ['--color-accent', '--color-on-accent', '--color-destructive', '--weight-semibold', '#7dd3fc']) {
      expect(css.toLowerCase()).not.toContain(retired);
    }
  });

  it('draws every colour from a token: no hex literal outside :root (D-01, D-04)', () => {
    const literals = afterRoot.match(/#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{5})?(?![\w-])/g) ?? [];
    expect(literals).toEqual([]);
  });

  it('references no remote URL and no @import: the console stays offline (T-261020exy-01)', () => {
    expect(css).not.toMatch(/https?:/);
    expect(css).not.toContain('@import');
  });

  it('draws the primary button from the primary tokens (D-02)', () => {
    const block = /\.button-primary\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';
    expect(block).toMatch(/background\s*:\s*var\(--color-primary\)/);
    expect(block).toMatch(/color\s*:\s*var\(--color-on-primary\)/);
  });
});

/** Index of the brace that closes the one opened at `openIndex`, or -1. */
function matchingBrace(text: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < text.length; i += 1) {
    if (text[i] === '{') depth += 1;
    else if (text[i] === '}') {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/** Splits on commas or whitespace that sit outside parentheses. */
function splitTopLevel(value: string, separator: ',' | ' '): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const character of value) {
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    const isSeparator = depth === 0 && (separator === ',' ? character === ',' : /\s/.test(character));
    if (isSeparator) {
      if (current.trim() !== '') parts.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  if (current.trim() !== '') parts.push(current.trim());
  return parts;
}

const MOTION_PROPERTIES = ['transform', 'opacity', 'stroke-dashoffset'];
const MOTION_LOOPS = ['culprit-spin', 'motion-drift'];
const ANIMATION_KEYWORDS = [
  'ease',
  'ease-in',
  'ease-out',
  'ease-in-out',
  'linear',
  'step-start',
  'step-end',
  'normal',
  'reverse',
  'alternate',
  'alternate-reverse',
  'none',
  'backwards',
  'running',
  'paused',
];

/**
 * Every way the stylesheet may break the motion rules (D-09, D-10, D-12), as readable messages.
 * Motion lives only inside `@media (prefers-reduced-motion: no-preference)`, keyframes animate only
 * transform, opacity and stroke-dashoffset, and the only loops are the loading spinner and the ambient drift.
 */
function motionViolations(cssText: string): string[] {
  const text = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
  const problems: string[] = [];

  let gated = '';
  let ungated = '';
  let cursor = 0;
  const mediaStart = /@media([^{]*)\{/g;
  for (;;) {
    mediaStart.lastIndex = cursor;
    const found = mediaStart.exec(text);
    if (found === null) break;
    const open = found.index + found[0].length - 1;
    const close = matchingBrace(text, open);
    if (close === -1) break;
    if ((found[1] ?? '').includes('prefers-reduced-motion: no-preference')) {
      ungated += text.slice(cursor, found.index);
      gated += `${text.slice(open + 1, close)}\n`;
      cursor = close + 1;
    } else {
      // A plain @media block stays ungated text; step inside it so a nested gated block is still found.
      ungated += text.slice(cursor, open + 1);
      cursor = open + 1;
    }
  }
  ungated += text.slice(cursor);

  for (const word of ['transition', 'animation', 'will-change', '@keyframes']) {
    if (ungated.includes(word)) problems.push(`ungated "${word}"`);
  }

  const defined = new Set<string>();
  const keyframes = /@keyframes\s+([\w-]+)\s*\{/g;
  for (let found = keyframes.exec(gated); found !== null; found = keyframes.exec(gated)) {
    const name = found[1] ?? '';
    defined.add(name);
    const open = found.index + found[0].length - 1;
    const body = gated.slice(open + 1, matchingBrace(gated, open));
    for (const declaration of body.matchAll(/([a-zA-Z-]+)\s*:/g)) {
      const property = declaration[1] ?? '';
      if (!MOTION_PROPERTIES.includes(property)) problems.push(`keyframes ${name} animate ${property}`);
    }
  }

  const declarations = /(?:^|[;{}\s])(transition-property|transition|animation-fill-mode|animation-iteration-count|animation-name|animation)\s*:\s*([^;}]+)/g;
  for (const declaration of gated.matchAll(declarations)) {
    const property = declaration[1] ?? '';
    const value = (declaration[2] ?? '').trim();
    if (property === 'transition' || property === 'transition-property') {
      for (const item of splitTopLevel(value, ',')) {
        const first = splitTopLevel(item, ' ')[0] ?? '';
        if (!MOTION_PROPERTIES.includes(first)) problems.push(`transition of "${first}"`);
      }
    } else if (property === 'animation-fill-mode') {
      if (/\b(forwards|both)\b/.test(value)) problems.push(`fill mode "${value}"`);
    } else if (property === 'animation-iteration-count') {
      if (value.includes('infinite')) problems.push('infinite iteration count');
    } else {
      for (const item of splitTopLevel(value, ',')) {
        const tokens = splitTopLevel(item, ' ');
        const names = tokens.filter(
          (token) =>
            /^[a-z][\w-]*$/.test(token) &&
            !ANIMATION_KEYWORDS.includes(token) &&
            token !== 'infinite' &&
            token !== 'forwards' &&
            token !== 'both',
        );
        for (const name of names) if (!defined.has(name)) problems.push(`animation uses undefined keyframes "${name}"`);
        if (tokens.includes('forwards') || tokens.includes('both')) problems.push(`fill mode in "${item}"`);
        if (tokens.includes('infinite') && !names.some((name) => MOTION_LOOPS.includes(name))) problems.push(`infinite loop in "${item}"`);
      }
    }
  }

  return problems;
}

describe('gated motion (D-09, D-10, D-12)', () => {
  const GATE = '@media (prefers-reduced-motion: no-preference)';

  it('ships a stylesheet with no motion violations', () => {
    expect(motionViolations(css)).toEqual([]);
  });

  it('actually contains gated motion, so the check above is not vacuous', () => {
    expect(css).toContain('prefers-reduced-motion: no-preference');
    expect(css).toContain('@keyframes motion-rise');
  });

  it.each<[string, string]>([
    ['an ungated transition', '.a { transition: opacity 200ms; }'],
    ['an ungated animation', '.a { animation: spin 1s; }'],
    ['ungated keyframes', '@keyframes spin { to { transform: rotate(1turn); } }'],
    ['ungated will-change', '.a { will-change: transform; }'],
    ['gated keyframes animating width', `${GATE} { @keyframes grow { from { width: 0; } } .a { animation: grow 1s; } }`],
    ['a gated transition on all', `${GATE} { .a { transition: all 200ms; } }`],
    ['a gated transition on background-color', `${GATE} { .a { transition: background-color 200ms; } }`],
    ['a gated infinite loop on an unknown name', `${GATE} { @keyframes wobble { to { transform: scale(2); } } .a { animation: wobble 1s infinite; } }`],
    ['a gated forwards fill', `${GATE} { @keyframes fade { from { opacity: 0; } } .a { animation: fade 1s forwards; } }`],
    ['a gated both fill', `${GATE} { @keyframes fade { from { opacity: 0; } } .a { animation: fade 1s both; } }`],
    ['a gated fill-mode declaration', `${GATE} { .a { animation-fill-mode: forwards; } }`],
    ['a gated animation of unknown keyframes', `${GATE} { .a { animation: missing 1s; } }`],
  ])('flags %s', (_label, snippet) => {
    expect(motionViolations(snippet).length).toBeGreaterThan(0);
  });

  it('accepts a clean gated snippet and the two allowed loops', () => {
    const clean = `${GATE} {
      @keyframes rise { from { opacity: 0; transform: translateY(12px); } }
      @keyframes draw { from { stroke-dashoffset: 1; } }
      @keyframes motion-drift { to { transform: translate(24px, 24px); } }
      .a { animation: rise var(--motion-enter) var(--motion-ease-out) backwards; animation-delay: calc(var(--index, 0) * var(--motion-stagger)); }
      .b { animation: draw 900ms ease-in-out 3; }
      .c { animation: motion-drift 48s linear infinite; }
      .d { transition: opacity 150ms, transform 150ms; }
    }`;
    expect(motionViolations(clean)).toEqual([]);
  });
});
