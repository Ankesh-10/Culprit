import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MOTION_TIMING, countFrame, decodeFrame, easeOutCubic, planEntrance } from '../../src/ui/motion-model';

const css = readFileSync(new URL('../../src/styles.css', import.meta.url), 'utf8');
const rootBlock = /:root\s*\{([^}]*)\}/.exec(css)?.[1] ?? '';

describe('MOTION_TIMING', () => {
  it('pins the choreography constants', () => {
    expect(MOTION_TIMING.staggerMs).toBe(80);
    expect(MOTION_TIMING.enterMs).toBe(600);
    expect(MOTION_TIMING.decodeMs).toBe(450);
    expect(MOTION_TIMING.countMs).toBe(600);
    expect(MOTION_TIMING.maxStaggerIndex).toBe(7);
  });

  it('matches the CSS custom properties so script and stylesheet cannot drift apart', () => {
    expect(rootBlock).toMatch(new RegExp(`--motion-stagger\\s*:\\s*${MOTION_TIMING.staggerMs}ms\\s*;`));
    expect(rootBlock).toMatch(new RegExp(`--motion-enter\\s*:\\s*${MOTION_TIMING.enterMs}ms\\s*;`));
    expect(rootBlock).toMatch(/--motion-ease-out\s*:\s*cubic-bezier\(0\.16, 1, 0\.3, 1\)\s*;/);
  });
});

describe('easeOutCubic', () => {
  it('hits the endpoints and the midpoint', () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBe(0.875);
  });

  it('clamps out-of-range input', () => {
    expect(easeOutCubic(-3)).toBe(0);
    expect(easeOutCubic(4)).toBe(1);
  });

  it('never decreases', () => {
    let last = -1;
    for (let step = 0; step <= 20; step += 1) {
      const value = easeOutCubic(step * 0.05);
      expect(value).toBeGreaterThanOrEqual(last);
      last = value;
    }
  });
});

describe('decodeFrame', () => {
  const hash = '2222222';

  it('returns the exact text once progress reaches 1, and for the empty string', () => {
    expect(decodeFrame(hash, 1)).toBe(hash);
    expect(decodeFrame(hash, 1.5)).toBe(hash);
    expect(decodeFrame('', 0.4)).toBe('');
  });

  it('keeps the length at every progress value', () => {
    for (let step = 0; step <= 20; step += 1) {
      expect(decodeFrame('a1b2c3d', step * 0.05)).toHaveLength(7);
    }
  });

  it('locks characters in from the left', () => {
    const text = 'a1b2c3d';
    const n = text.length;
    for (let k = 0; k <= n; k += 1) {
      expect(decodeFrame(text, k / n).startsWith(text.slice(0, k))).toBe(true);
    }
  });

  it('is deterministic', () => {
    expect(decodeFrame('a1b2c3d', 0.3)).toBe(decodeFrame('a1b2c3d', 0.3));
  });

  it('draws unlocked characters from the hex glyph set and keeps spaces', () => {
    const frame = decodeFrame('zz zz', 0);
    expect(frame[2]).toBe(' ');
    for (const character of frame.replace(' ', '')) expect('0123456789abcdef').toContain(character);
  });

  it('treats negative progress as zero', () => {
    expect(decodeFrame('a1b2c3d', -2)).toBe(decodeFrame('a1b2c3d', 0));
  });
});

describe('countFrame', () => {
  it('counts the score from zero with the same decimals', () => {
    expect(countFrame('0.91', 0)).toBe('0.00');
    expect(countFrame('0.91', 1)).toBe('0.91');
  });

  it('animates only the first number in a sentence', () => {
    expect(countFrame('Matches 5 of 5 errors', 0)).toBe('Matches 0 of 5 errors');
    expect(countFrame('Matches 5 of 5 errors', 1)).toBe('Matches 5 of 5 errors');
  });

  it('never decreases, never exceeds the final value and keeps the decimal count', () => {
    let last = -1;
    for (let step = 0; step <= 20; step += 1) {
      const frame = countFrame('0.91', step * 0.05);
      expect(frame).toMatch(/^\d\.\d\d$/);
      const numeric = Number(frame);
      expect(numeric).toBeGreaterThanOrEqual(last);
      expect(numeric).toBeLessThanOrEqual(0.91);
      last = numeric;
    }
  });

  it('returns text without a number, or whose first number is zero, unchanged', () => {
    expect(countFrame('No clear culprit', 0.3)).toBe('No clear culprit');
    expect(countFrame('Matches 0 of 4 errors', 0)).toBe('Matches 0 of 4 errors');
    expect(countFrame('Matches 0 of 4 errors', 0.5)).toBe('Matches 0 of 4 errors');
  });
});

describe('planEntrance', () => {
  it('plays on-screen sections at once with staggered indices and defers the rest', () => {
    expect(planEntrance([100, 300, 900, 1500], 720, 7)).toEqual({
      immediate: [
        { position: 0, index: 0 },
        { position: 1, index: 1 },
      ],
      deferred: [2, 3],
    });
  });

  it('caps the stagger index', () => {
    const tops = Array.from({ length: 10 }, (_, i) => i * 10);
    const plan = planEntrance(tops, 720, 7);
    expect(plan.immediate.map((entry) => entry.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 7, 7]);
    expect(plan.deferred).toEqual([]);
  });

  it('defaults the cap to the timing constant', () => {
    const tops = Array.from({ length: 12 }, () => 0);
    const plan = planEntrance(tops, 720);
    expect(Math.max(...plan.immediate.map((entry) => entry.index))).toBe(MOTION_TIMING.maxStaggerIndex);
  });
});
