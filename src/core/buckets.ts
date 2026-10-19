import type { ErrorGroup, LogEvent, UtcBucket } from './model';
import { InputLimitError } from './input-errors';
import { compareText } from './normalization';

export type { UtcBucket } from './model';

export const DEFAULT_BUCKET_MINUTES = 5;

/** Upper bound on allocated buckets so a caller-controlled timestamp span cannot exhaust memory. */
export const MAX_BUCKETS = 10_000;

/** A typed failure for an invalid deterministic analysis option. */
export class AnalysisInputError extends Error {
  readonly code = 'INVALID_ANALYSIS_INPUT' as const;

  constructor(message: string) {
    super(message);
    this.name = 'AnalysisInputError';
  }
}

function timestampForEpoch(epoch: number): string {
  return new Date(epoch).toISOString();
}

function eventOrder(left: LogEvent, right: LogEvent): number {
  return Date.parse(left.timestampUtc) - Date.parse(right.timestampUtc) || compareText(left.eventId, right.eventId);
}

function validateBucketMinutes(bucketMinutes: number): void {
  if (!Number.isFinite(bucketMinutes) || !Number.isInteger(bucketMinutes) || bucketMinutes <= 0) {
    throw new AnalysisInputError('Bucket width must be a finite positive integer number of minutes.');
  }
}

function emptyBucket(startEpoch: number, widthMs: number): UtcBucket {
  return {
    bucketStartUtc: timestampForEpoch(startEpoch),
    bucketEndUtc: timestampForEpoch(startEpoch + widthMs),
    errorCount: 0,
    signatureCounts: {},
    eventIds: [],
    errorGroupSignatures: [],
    commitShas: [],
  };
}

/**
 * Build all fixed-width half-open UTC buckets covering the supplied errors.
 * The first bucket is anchored to the floor of the minimum supplied event
 * epoch, and an event exactly on an edge belongs to the later bucket.
 */
export function buildUtcBuckets(
  events: LogEvent[],
  groups: ErrorGroup[],
  bucketMinutes = DEFAULT_BUCKET_MINUTES,
): UtcBucket[] {
  validateBucketMinutes(bucketMinutes);
  if (events.length === 0) return [];
  const widthMs = bucketMinutes * 60_000;
  const orderedEvents = [...events].sort(eventOrder);
  const epochs = orderedEvents.map((event) => Date.parse(event.timestampUtc));
  if (epochs.some((epoch) => !Number.isFinite(epoch))) {
    throw new AnalysisInputError('Every event timestamp must be a finite UTC timestamp.');
  }
  const firstEpoch = epochs[0];
  const lastEpoch = epochs.at(-1);
  if (firstEpoch === undefined || lastEpoch === undefined) return [];
  const firstBucketEpoch = Math.floor(firstEpoch / widthMs) * widthMs;
  const lastBucketEpoch = Math.floor(lastEpoch / widthMs) * widthMs;
  const bucketCount = (lastBucketEpoch - firstBucketEpoch) / widthMs + 1;
  if (bucketCount > MAX_BUCKETS) {
    throw new InputLimitError(
      `The log spans ${bucketCount} UTC buckets of ${bucketMinutes} minute(s), which exceeds the limit of ${MAX_BUCKETS}; supply a shorter time range or a wider bucket.`,
      { source: 'logs' },
    );
  }
  const buckets = new Map<number, UtcBucket>();
  for (let start = firstBucketEpoch; start <= lastBucketEpoch; start += widthMs) {
    buckets.set(start, emptyBucket(start, widthMs));
  }

  const signatureByEventId = new Map<string, string>();
  for (const group of groups) {
    for (const eventId of group.eventIds) signatureByEventId.set(eventId, group.signature);
  }
  for (const event of orderedEvents) {
    if (event.level !== 'error' && event.level !== 'fatal') continue;
    const epoch = Date.parse(event.timestampUtc);
    const start = Math.floor(epoch / widthMs) * widthMs;
    const bucket = buckets.get(start);
    if (bucket === undefined) throw new AnalysisInputError('Event could not be placed in its UTC bucket.');
    const signature = signatureByEventId.get(event.eventId);
    if (signature === undefined) continue;
    bucket.errorCount += 1;
    bucket.eventIds.push(event.eventId);
    bucket.signatureCounts[signature] = (bucket.signatureCounts[signature] ?? 0) + 1;
  }
  for (const bucket of buckets.values()) {
    bucket.eventIds.sort(compareText);
    bucket.errorGroupSignatures = Object.keys(bucket.signatureCounts).sort(compareText);
    bucket.signatureCounts = Object.fromEntries(bucket.errorGroupSignatures.map((signature) => [signature, bucket.signatureCounts[signature] ?? 0]));
  }
  return [...buckets.values()];
}
