import type { ErrorGroup, LogEvent, OnsetAnalysis, OnsetClassification, UtcBucket } from './model';
import { DEFAULT_BUCKET_MINUTES, buildUtcBuckets } from './buckets';

export const MIN_OBSERVED_BUCKETS = 3;
export const MIN_ERROR_EVENTS = 3;
export const SPIKE_MIN_PEAK_COUNT = 3;
export const SPIKE_BASELINE_MULTIPLIER = 3;
export const SPIKE_MIN_INCREASE = 2;
export const RAMP_RUN_LENGTH = 3;
export const RAMP_MIN_INCREASE = 2;

function mean(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function peakIndex(buckets: UtcBucket[]): number {
  let index = 0;
  for (let candidate = 1; candidate < buckets.length; candidate += 1) {
    if ((buckets[candidate]?.errorCount ?? 0) > (buckets[index]?.errorCount ?? 0)) index = candidate;
  }
  return index;
}

function errorCount(buckets: UtcBucket[]): number {
  return buckets.reduce((total, bucket) => total + bucket.errorCount, 0);
}

function baseAnalysis(buckets: UtcBucket[], classification: OnsetClassification, baselineRate: number, peakRate: number, appliedRule: string, explanation: string, onsetBucket: UtcBucket | null, onsetWindow: { startUtc: string; endUtc: string } | null): OnsetAnalysis {
  return {
    classification,
    class: classification,
    buckets,
    baselineRate,
    peakRate,
    onsetBucket,
    onsetWindow,
    windowStartUtc: onsetWindow?.startUtc ?? null,
    windowEndUtc: onsetWindow?.endUtc ?? null,
    appliedRule,
    explanation,
  };
}

function classifyBuckets(buckets: UtcBucket[]): OnsetAnalysis {
  const orderedBuckets = [...buckets].sort((left, right) => left.bucketStartUtc < right.bucketStartUtc ? -1 : left.bucketStartUtc > right.bucketStartUtc ? 1 : 0);
  const totalErrors = errorCount(orderedBuckets);
  const baselineRate = orderedBuckets.length >= 2 ? mean([orderedBuckets[0]?.errorCount ?? 0, orderedBuckets[1]?.errorCount ?? 0]) : 0;
  const peak = orderedBuckets.length === 0 ? 0 : peakIndex(orderedBuckets);
  const peakRate = orderedBuckets[peak]?.errorCount ?? 0;
  if (orderedBuckets.length < MIN_OBSERVED_BUCKETS || totalErrors < MIN_ERROR_EVENTS) {
    return baseAnalysis(
      orderedBuckets,
      'insufficient-data',
      baselineRate,
      peakRate,
      `insufficient-data: requires at least ${MIN_OBSERVED_BUCKETS} observed buckets and ${MIN_ERROR_EVENTS} error events`,
      `Insufficient data: at least ${MIN_OBSERVED_BUCKETS} observed buckets and ${MIN_ERROR_EVENTS} error events are required; no onset window was inferred.`,
      null,
      null,
    );
  }

  const preceding = peak > 0 ? orderedBuckets[peak - 1]?.errorCount ?? 0 : 0;
  const spikeThreshold = SPIKE_BASELINE_MULTIPLIER * baselineRate;
  if (peak >= 2 && peakRate >= SPIKE_MIN_PEAK_COUNT && peakRate >= spikeThreshold && peakRate - preceding >= SPIKE_MIN_INCREASE) {
    const peakBucket = orderedBuckets[peak];
    if (peakBucket !== undefined) {
      return baseAnalysis(
        orderedBuckets,
        'spike',
        baselineRate,
        peakRate,
        `spike: peak >= ${SPIKE_MIN_PEAK_COUNT}, peak >= ${SPIKE_BASELINE_MULTIPLIER}x baseline mean, and increase >= ${SPIKE_MIN_INCREASE} over the preceding bucket`,
        `Spike detected because the peak rate (${peakRate}) is at least ${SPIKE_MIN_PEAK_COUNT}, at least ${SPIKE_BASELINE_MULTIPLIER}x the first-two-bucket baseline mean (${baselineRate}), and ${SPIKE_MIN_INCREASE} higher than the preceding bucket.`,
        peakBucket,
        { startUtc: peakBucket.bucketStartUtc, endUtc: peakBucket.bucketEndUtc },
      );
    }
  }

  for (let start = 0; start <= orderedBuckets.length - RAMP_RUN_LENGTH; start += 1) {
    const run = orderedBuckets.slice(start, start + RAMP_RUN_LENGTH);
    const first = run[0];
    const last = run.at(-1);
    if (first === undefined || last === undefined) continue;
    const nonDecreasing = run.every((bucket, index) => index === 0 || bucket.errorCount >= (run[index - 1]?.errorCount ?? 0));
    const increase = last.errorCount - first.errorCount;
    if (nonDecreasing && increase >= RAMP_MIN_INCREASE && last.errorCount > baselineRate) {
      return baseAnalysis(
        orderedBuckets,
        'ramp',
        baselineRate,
        peakRate,
        `ramp: ${RAMP_RUN_LENGTH}-bucket non-decreasing run, final-first >= ${RAMP_MIN_INCREASE}, and final > baseline mean`,
        `Ramp detected in the ${RAMP_RUN_LENGTH}-bucket window because counts never decrease, rise by at least ${RAMP_MIN_INCREASE} from first to last, and finish above the first-two-bucket baseline mean (${baselineRate}).`,
        first,
        { startUtc: first.bucketStartUtc, endUtc: last.bucketEndUtc },
      );
    }
  }

  return baseAnalysis(
    orderedBuckets,
    'none',
    baselineRate,
    peakRate,
    'none: no spike or qualifying ramp rule matched',
    `No incident pattern detected: the sufficiently populated series matched neither the fixed spike thresholds nor the ${RAMP_RUN_LENGTH}-bucket ramp rule.`,
    null,
    null,
  );
}

export function classifyOnset(events: LogEvent[], groups: ErrorGroup[], bucketMinutes?: number): OnsetAnalysis;
export function classifyOnset(buckets: UtcBucket[]): OnsetAnalysis;
export function classifyOnset(eventsOrBuckets: LogEvent[] | UtcBucket[], groupsOrBucketMinutes: ErrorGroup[] | number = [], bucketMinutes = DEFAULT_BUCKET_MINUTES): OnsetAnalysis {
  const first = eventsOrBuckets[0];
  if (first !== undefined && 'bucketStartUtc' in first) return classifyBuckets(eventsOrBuckets as UtcBucket[]);
  const groups = Array.isArray(groupsOrBucketMinutes) ? groupsOrBucketMinutes : [];
  const width = typeof groupsOrBucketMinutes === 'number' ? groupsOrBucketMinutes : bucketMinutes;
  return classifyBuckets(buildUtcBuckets(eventsOrBuckets as LogEvent[], groups, width));
}
