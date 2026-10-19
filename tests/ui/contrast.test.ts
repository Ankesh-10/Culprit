import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../src/styles.css', import.meta.url), 'utf8');
const rootBlock = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';

/** The UI-SPEC hex contract. */
const SPEC: Record<string, string> = {
  'color-page': '#0b1220',
  'color-surface': '#121e31',
  'color-raised': '#1a2a42',
  'color-ink': '#e9eef5',
  'color-ink-2': '#b7c3d4',
  'color-muted': '#8fa0b8',
  'color-accent': '#7dd3fc',
  'color-on-accent': '#06222f',
  'color-destructive': '#d03b3b',
  'color-control-border': '#66799a',
  'color-good': '#0ca30c',
  'color-warning': '#fab219',
  'color-serious': '#ec835a',
  'color-critical': '#d03b3b',
  'viz-series-errors': '#3987e5',
  'viz-onset': '#d95926',
  'viz-suspect': '#199e70',
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

const WHITE = '#ffffff';
const BACKGROUNDS = ['color-page', 'color-surface', 'color-raised'] as const;

describe('shipped colour tokens', () => {
  it.each(Object.entries(SPEC))('--%s equals the UI-SPEC value %s', (name, hex) => {
    expect(token(name)).toBe(hex);
  });
});

describe('WCAG contrast of the shipped tokens', () => {
  it('keeps every text colour at 4.5:1 or better on page, surface and raised', () => {
    const failures: string[] = [];
    for (const foreground of ['color-ink', 'color-ink-2', 'color-muted']) {
      for (const background of BACKGROUNDS) {
        const result = ratio(value(foreground), value(background));
        if (result < 4.5) failures.push(`${foreground} on ${background}: ${round2(result)}`);
      }
    }
    const onAccent = ratio(value('color-on-accent'), value('color-accent'));
    if (onAccent < 4.5) failures.push(`color-on-accent on color-accent: ${round2(onAccent)}`);
    const onDestructive = ratio(WHITE, value('color-destructive'));
    if (onDestructive < 4.5) failures.push(`white on color-destructive: ${round2(onDestructive)}`);
    expect(failures).toEqual([]);
  });

  it('keeps focus rings, control borders, status icons and chart marks at 3:1 or better', () => {
    const failures: string[] = [];
    const nonText = ['color-accent', 'color-control-border', 'color-good', 'color-warning', 'color-serious', 'color-critical'];
    for (const foreground of nonText) {
      for (const background of BACKGROUNDS) {
        const result = ratio(value(foreground), value(background));
        if (result < 3) failures.push(`${foreground} on ${background}: ${round2(result)}`);
      }
    }
    for (const foreground of ['viz-series-errors', 'viz-onset', 'viz-suspect']) {
      for (const background of ['color-page', 'color-surface']) {
        const result = ratio(value(foreground), value(background));
        if (result < 3) failures.push(`${foreground} on ${background}: ${round2(result)}`);
      }
    }
    expect(failures).toEqual([]);
  });

  it('matches the figures recorded in the UI-SPEC', () => {
    const pinned: Array<[string, string, number]> = [
      ['color-ink', 'color-surface', 14.34],
      ['color-ink-2', 'color-surface', 9.37],
      ['color-muted', 'color-surface', 6.28],
      ['color-muted', 'color-raised', 5.43],
      ['color-accent', 'color-surface', 10.03],
      ['color-accent', 'color-page', 11.23],
      ['color-control-border', 'color-surface', 3.8],
      ['color-control-border', 'color-raised', 3.28],
      ['color-good', 'color-surface', 4.98],
      ['color-warning', 'color-surface', 9.12],
      ['color-serious', 'color-surface', 6.34],
      ['color-critical', 'color-surface', 3.48],
      ['color-critical', 'color-raised', 3.01],
      ['viz-onset', 'color-surface', 4.31],
    ];
    const actual = pinned.map(([foreground, background]) => round2(ratio(value(foreground), value(background))));
    expect(actual).toEqual(pinned.map((entry) => entry[2]));
    expect(round2(ratio(value('color-on-accent'), value('color-accent')))).toBe(9.86);
    expect(round2(ratio(WHITE, value('color-destructive')))).toBe(4.8);
  });
});
