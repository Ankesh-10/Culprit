import { afterEach, describe, expect, it } from 'vitest';
import {
  formatCompactCount,
  formatDuration,
  formatGapShort,
  formatLineRange,
  formatMiB,
  formatPathRange,
  formatScore,
  formatTimeGap,
  formatUtcClock,
  formatUtcDateTime,
  formatUtcInterval,
  formatUtcSeconds,
  plural,
  traceMatchLabel,
} from '../../src/ui/format';

describe('UTC formatters', () => {
  it('formats the clock with and without milliseconds', () => {
    expect(formatUtcClock('2026-10-19T04:18:00Z')).toBe('04:18 UTC');
    expect(formatUtcClock('2026-10-19T04:18:00.000Z')).toBe('04:18 UTC');
  });

  it('formats date-time, seconds and intervals', () => {
    expect(formatUtcDateTime('2026-10-19T04:18:00.000Z')).toBe('2026-10-19 04:18 UTC');
    expect(formatUtcSeconds('2026-10-19T04:20:30.000Z')).toBe('04:20:30');
    expect(formatUtcInterval('2026-10-19T04:30:00.000Z', '2026-10-19T04:35:00.000Z')).toBe('04:30–04:35 UTC');
  });

  it('returns non-ISO input unchanged', () => {
    for (const input of ['yesterday', '2026-10-19 04:18:00', '2026-10-19T04:18:00+05:30', '']) {
      expect(formatUtcClock(input)).toBe(input);
      expect(formatUtcDateTime(input)).toBe(input);
      expect(formatUtcSeconds(input)).toBe(input);
    }
    expect(formatUtcInterval('bad', '2026-10-19T04:35:00.000Z')).toBe('bad–2026-10-19T04:35:00.000Z');
  });
});

describe('durations and gaps', () => {
  it('formats durations', () => {
    expect(formatDuration(12)).toBe('12 min');
    expect(formatDuration(65)).toBe('1 h 5 min');
    expect(formatDuration(60)).toBe('1 h');
    expect(formatDuration(0)).toBe('0 min');
    expect(formatDuration(11.5)).toBe('12 min');
    expect(formatDuration(0.2)).toBe('under 1 min');
  });

  it('formats time gaps', () => {
    expect(formatTimeGap(12)).toBe('12 min before onset window start');
    expect(formatTimeGap(0)).toBe('At the onset window start');
    expect(formatGapShort(12)).toBe('12 min before onset');
    expect(formatGapShort(0)).toBe('At onset');
  });
});

describe('numbers and labels', () => {
  it('rounds scores', () => {
    expect(formatScore(0.912065, 2)).toBe('0.91');
    expect(formatScore(0.912065, 3)).toBe('0.912');
    expect(formatScore(0.5, 2)).toBe('0.50');
  });

  it('pluralizes', () => {
    expect(plural(1, 'suspect')).toBe('1 suspect');
    expect(plural(2, 'suspect')).toBe('2 suspects');
    expect(plural(0, 'event')).toBe('0 events');
    expect(plural(2, 'match', 'matches')).toBe('2 matches');
  });

  it('formats sizes, ranges and counts', () => {
    expect(formatMiB(1572864)).toBe('1.5 MiB');
    expect(formatLineRange(104, 126)).toBe('L104–126');
    expect(formatLineRange(118, 118)).toBe('L118');
    expect(formatPathRange('src/a.ts', 104, 126)).toBe('src/a.ts:104–126');
    expect(formatPathRange('src/a.ts', null, null)).toBe('src/a.ts');
    expect(formatCompactCount(42)).toBe('42');
    expect(formatCompactCount(1000)).toBe('1K');
    expect(formatCompactCount(1500)).toBe('1.5K');
  });

  it('labels trace matches', () => {
    expect(traceMatchLabel('exact-line')).toBe('Exact line');
    expect(traceMatchLabel('nearby-line')).toBe('Nearby line');
    expect(traceMatchLabel('file-only')).toBe('File only');
    expect(traceMatchLabel('none')).toBe('No trace match');
  });
});

describe('time zone independence', () => {
  const originalTz = process.env['TZ'];

  afterEach(() => {
    if (originalTz === undefined) delete process.env['TZ'];
    else process.env['TZ'] = originalTz;
  });

  function snapshot(): string[] {
    return [
      formatUtcClock('2026-10-19T04:18:00Z'),
      formatUtcDateTime('2026-10-19T04:18:00.000Z'),
      formatUtcSeconds('2026-10-19T04:20:30.000Z'),
      formatUtcInterval('2026-10-19T04:30:00.000Z', '2026-10-19T04:35:00.000Z'),
      formatDuration(65),
      formatTimeGap(12),
      formatGapShort(25),
      formatScore(0.912065, 2),
      plural(2, 'suspect'),
      formatMiB(1572864),
      formatPathRange('src/a.ts', 1, 9),
      formatCompactCount(1500),
    ];
  }

  it('prints identical output under different process time zones', () => {
    const baseline = snapshot();
    for (const zone of ['Asia/Kolkata', 'America/Los_Angeles']) {
      process.env['TZ'] = zone;
      expect(snapshot()).toEqual(baseline);
    }
  });
});
