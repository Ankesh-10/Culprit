import { describe, expect, it } from 'vitest';
import type { ErrorGroup, LogEvent, UtcBucket } from '../../src/core/model';
import { buildUtcBuckets } from '../../src/core/buckets';
import { classifyOnset } from '../../src/core/onset';

function event(id: string, timestampUtc: string): LogEvent {
  return {
    eventId: id,
    timestampUtc,
    level: 'error',
    message: 'failure',
    rawMessage: 'failure',
    exception: 'Failure',
    stack: null,
    stackFrames: [],
    source: { source: 'test', line: null, record: null },
    rawLine: '',
  };
}

function group(eventIds: string[]): ErrorGroup {
  return {
    signature: 'Failure | failure | <no-application-frame>',
    representativeMessage: 'failure',
    count: eventIds.length,
    firstSeenUtc: '2026-10-19T08:00:00.000Z',
    lastSeenUtc: '2026-10-19T08:00:00.000Z',
    eventIds,
    stackFrames: [],
  };
}

function bucket(index: number, errorCount: number): UtcBucket {
  const start = new Date(Date.parse('2026-10-19T08:00:00Z') + index * 300_000).toISOString();
  const end = new Date(Date.parse(start) + 300_000).toISOString();
  return {
    bucketStartUtc: start,
    bucketEndUtc: end,
    errorCount,
    signatureCounts: errorCount === 0 ? {} : { Failure: errorCount },
    eventIds: [],
    errorGroupSignatures: errorCount === 0 ? [] : ['Failure'],
    commitShas: [],
  };
}

describe('fixed UTC buckets', () => {
  it('uses half-open boundaries and includes gaps', () => {
    const events = [
      event('e1', '2026-10-19T08:00:00Z'),
      event('e2', '2026-10-19T08:10:00Z'),
    ];
    const buckets = buildUtcBuckets(events, [group(['e1', 'e2'])], 5);
    expect(buckets.map((bucket) => [bucket.bucketStartUtc, bucket.bucketEndUtc, bucket.errorCount])).toEqual([
      ['2026-10-19T08:00:00.000Z', '2026-10-19T08:05:00.000Z', 1],
      ['2026-10-19T08:05:00.000Z', '2026-10-19T08:10:00.000Z', 0],
      ['2026-10-19T08:10:00.000Z', '2026-10-19T08:15:00.000Z', 1],
    ]);
    expect(buckets[2]?.eventIds).toEqual(['e2']);
  });

  it('is independent of permitted event ordering and returns no bucket for empty input', () => {
    const events = [event('e2', '2026-10-19T08:10:00+00:00'), event('e1', '2026-10-19T08:00:00Z')];
    const groups = [group(['e1', 'e2'])];
    expect(buildUtcBuckets(events, groups, 5)).toEqual(buildUtcBuckets([...events].reverse(), groups, 5));
    expect(buildUtcBuckets([], groups, 5)).toEqual([]);
  });

  it('rejects non-positive, fractional, and non-finite widths', () => {
    expect(() => buildUtcBuckets([], [], 0)).toThrowError('positive integer');
    expect(() => buildUtcBuckets([], [], 1.5)).toThrowError('positive integer');
    expect(() => buildUtcBuckets([], [], Number.NaN)).toThrowError('positive integer');
  });

  it('classifies a sharp spike using the fixed thresholds', () => {
    const analysis = classifyOnset([bucket(0, 1), bucket(1, 1), bucket(2, 6), bucket(3, 0)]);
    expect(analysis.classification).toBe('spike');
    expect(analysis.baselineRate).toBe(1);
    expect(analysis.peakRate).toBe(6);
    expect(analysis.windowStartUtc).toBe('2026-10-19T08:10:00.000Z');
    expect(analysis.windowEndUtc).toBe('2026-10-19T08:15:00.000Z');
    expect(analysis.explanation).toContain('at least 3x');
  });

  it('classifies a gradual non-decreasing run as a ramp when spike increase is too small', () => {
    const analysis = classifyOnset([bucket(0, 0), bucket(1, 1), bucket(2, 2), bucket(3, 3)]);
    expect(analysis.classification).toBe('ramp');
    expect(analysis.windowStartUtc).toBe('2026-10-19T08:00:00.000Z');
    expect(analysis.windowEndUtc).toBe('2026-10-19T08:15:00.000Z');
    expect(analysis.appliedRule).toContain('3-bucket non-decreasing');
  });

  it('returns none for stable data and insufficient-data without an onset timestamp', () => {
    const stable = classifyOnset([bucket(0, 1), bucket(1, 1), bucket(2, 1)]);
    expect(stable.classification).toBe('none');
    expect(stable.windowStartUtc).toBeNull();
    const short = classifyOnset([bucket(0, 1), bucket(1, 1)]);
    expect(short.classification).toBe('insufficient-data');
    expect(short.windowStartUtc).toBeNull();
    expect(short.onsetBucket).toBeNull();
  });

  it('keeps classification and explanation deterministic across repeated calls', () => {
    const buckets = [bucket(0, 0), bucket(1, 1), bucket(2, 2), bucket(3, 3)];
    expect(classifyOnset(buckets)).toEqual(classifyOnset([...buckets].reverse()));
  });
});
