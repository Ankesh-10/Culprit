/**
 * Pure motion maths for the result reveal: easing, the hash decode, the number count-up and the entrance
 * stagger plan. No DOM, no clock and no randomness, so every frame is a function of its inputs and the final
 * frame is always the exact final text (the verdict values are never left in a wrong state).
 */

/** Script-side timing. `tests/ui/motion-model.test.ts` pins these to the CSS custom properties. */
export const MOTION_TIMING = {
  enterMs: 600,
  staggerMs: 80,
  maxStaggerIndex: 7,
  rollDelayMs: 120,
  decodeMs: 450,
  countMs: 600,
} as const;

const GLYPHS = '0123456789abcdef';
const DECODE_STEPS = 24;

function clamp01(value: number): number {
  if (!(value > 0)) return 0;
  return value > 1 ? 1 : value;
}

export function easeOutCubic(t: number): number {
  const remaining = 1 - clamp01(t);
  return 1 - remaining * remaining * remaining;
}

/**
 * The text as it looks at `progress` of a left-to-right decode: the leading characters are locked to the
 * final text and the rest cycle through hex glyphs picked by fixed arithmetic. Same inputs, same output.
 */
export function decodeFrame(finalText: string, progress: number): string {
  const p = clamp01(progress);
  if (p >= 1 || finalText === '') return finalText;
  const length = finalText.length;
  const locked = Math.min(length, Math.floor(p * length + 1e-9));
  const step = Math.floor(p * DECODE_STEPS);
  let out = '';
  for (let position = 0; position < length; position += 1) {
    const character = finalText.charAt(position);
    if (position < locked || character === ' ') {
      out += character;
    } else {
      out += GLYPHS.charAt((position * 7 + step * 5 + finalText.charCodeAt(position)) % GLYPHS.length);
    }
  }
  return out;
}

/**
 * Counts the first number in `finalText` up from zero with the same number of decimals; everything else in
 * the text is untouched. Text with no number, or whose first number is zero, never changes.
 */
export function countFrame(finalText: string, progress: number): string {
  const p = clamp01(progress);
  if (p >= 1) return finalText;
  const found = /\d+(?:\.(\d+))?/.exec(finalText);
  if (found === null) return finalText;
  const token = found[0];
  const decimals = (found[1] ?? '').length;
  const scaled = Number(token.replace('.', ''));
  if (!Number.isFinite(scaled) || scaled === 0) return finalText;
  const current = Math.floor(scaled * easeOutCubic(p));
  const digits = String(current).padStart(decimals + 1, '0');
  const formatted = decimals === 0 ? digits : `${digits.slice(0, digits.length - decimals)}.${digits.slice(digits.length - decimals)}`;
  return finalText.slice(0, found.index) + formatted + finalText.slice(found.index + token.length);
}

export interface EntrancePlan {
  /** Sections already in the viewport: play at once, `index` is their stagger slot (capped). */
  immediate: Array<{ position: number; index: number }>;
  /** Positions of sections below the fold: play when they first scroll into view. */
  deferred: number[];
}

export function planEntrance(tops: readonly number[], viewportHeight: number, maxIndex: number = MOTION_TIMING.maxStaggerIndex): EntrancePlan {
  const immediate: EntrancePlan['immediate'] = [];
  const deferred: number[] = [];
  tops.forEach((top, position) => {
    if (top < viewportHeight) immediate.push({ position, index: Math.min(immediate.length, maxIndex) });
    else deferred.push(position);
  });
  return { immediate, deferred };
}
