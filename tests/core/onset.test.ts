import { describe, expect, it } from 'vitest';
import type { ErrorGroup, LogEvent } from '../../src/core/model';
import { buildUtcBuckets } from '../../src/core/buckets';

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
});
