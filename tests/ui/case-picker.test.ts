import { existsSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { patternChip } from '../../src/ui/case-picker';
import { fontFacesFromGlob } from '../../src/ui/fonts';
import { sparklinePath } from '../../src/ui/sparkline';

const fontsDirectory = new URL('../../src/assets/fonts/', import.meta.url);

function numbersIn(path: string): number[] {
  return [...path.matchAll(/-?\d+(?:\.\d+)?/g)].map((match) => Number(match[0]));
}

describe('sparklinePath', () => {
  it('plots evenly spaced points with the maximum at the top inset and zero at the bottom inset', () => {
    const path = sparklinePath([2, 0, 3], 120, 28);
    expect(path.startsWith('M')).toBe(true);
    expect((path.match(/[ML]/g) ?? []).length).toBe(3);
    const values = numbersIn(path);
    expect(values).toHaveLength(6);
    const xs = [values[0], values[2], values[4]];
    const ys = [values[1], values[3], values[5]];
    expect(xs).toEqual([0, 60, 120]);
    expect(ys[2]).toBe(2);
    expect(ys[1]).toBe(26);
    expect(ys[0]).toBe(10);
  });

  it('is byte-stable for the same input', () => {
    expect(sparklinePath([1, 4, 2, 9], 120, 28)).toBe(sparklinePath([1, 4, 2, 9], 120, 28));
  });

  it('draws a single bucket as a flat line across the width', () => {
    const values = numbersIn(sparklinePath([5], 120, 28));
    expect(values).toHaveLength(4);
    expect([values[0], values[2]]).toEqual([0, 120]);
    expect(values[1]).toBe(values[3]);
  });

  it('returns an empty string for no buckets', () => {
    expect(sparklinePath([], 120, 28)).toBe('');
  });

  it('keeps an all-zero series flat on the bottom inset', () => {
    const values = numbersIn(sparklinePath([0, 0, 0], 120, 28));
    expect([values[1], values[3], values[5]]).toEqual([26, 26, 26]);
  });
});

describe('patternChip', () => {
  it('names the three demonstrated onset patterns', () => {
    expect(patternChip('spike')).toBe('Sharp spike');
    expect(patternChip('ramp')).toBe('Slow ramp');
    expect(patternChip('ambiguous')).toBe('Ambiguous');
  });

  it('returns any other class unchanged', () => {
    expect(patternChip('none')).toBe('none');
  });
});

describe('fontFacesFromGlob', () => {
  it('maps the expected files to their families, Inter first, and ignores others', () => {
    expect(
      fontFacesFromGlob({
        '../assets/fonts/GeistMono-Variable.woff2': 'b.woff2',
        '../assets/fonts/Inter-Variable.woff2': 'i.woff2',
        '../assets/fonts/Other.woff2': 'c.woff2',
        '../assets/fonts/Geist-Variable.woff2': 'a.woff2',
      }),
    ).toEqual([
      { family: 'Inter', url: 'i.woff2' },
      { family: 'Geist', url: 'a.woff2' },
      { family: 'Geist Mono', url: 'b.woff2' },
    ]);
  });

  it('maps a lone Inter file to just Inter', () => {
    expect(fontFacesFromGlob({ '../assets/fonts/Inter-Variable.woff2': 'i.woff2' })).toEqual([
      { family: 'Inter', url: 'i.woff2' },
    ]);
  });

  it('returns nothing for an empty record', () => {
    expect(fontFacesFromGlob({})).toEqual([]);
  });
});

describe('bundled font licence', () => {
  const woff2 = existsSync(fontsDirectory) ? readdirSync(fontsDirectory).filter((name) => name.endsWith('.woff2')) : [];

  it('only ever ships the three expected files, with the OFL text beside them', () => {
    for (const name of woff2) {
      expect(['Inter-Variable.woff2', 'Geist-Variable.woff2', 'GeistMono-Variable.woff2']).toContain(name);
    }
    if (woff2.length > 0) expect(existsSync(new URL('OFL.txt', fontsDirectory))).toBe(true);
  });

  it('records the font provenance note', () => {
    expect(existsSync(new URL('FONTS.md', fontsDirectory))).toBe(true);
  });
});
