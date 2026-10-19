import type { TimelinePoint } from '../core/model';

/**
 * Pure timeline geometry: domain, scales, paths and bucket lookup. No DOM, no clock and no locale.
 * Times are parsed with `Date.parse` from the normalized UTC strings only.
 */

export interface TimelineDomain {
  startMs: number;
  endMs: number;
  /** Start of the first error interval. */
  bucketStartMs: number;
  /** End of the last error interval. */
  bucketEndMs: number;
  clipped: boolean;
  hiddenEarlier: number;
  hiddenLater: number;
}

export interface CommitTime {
  sha: string;
  timestampUtc: string;
}

/** Extended domains wider than this multiple of the log span are clipped. */
export const DOMAIN_CLIP_FACTOR = 6;

function round2(value: number): number {
  const rounded = Math.round(value * 100) / 100;
  return rounded === 0 ? 0 : rounded;
}

/**
 * The visible time range: from the earlier of the first interval and the earliest eligible commit to the
 * later of the last interval and the latest eligible commit. When that would exceed six times the log span
 * it is clipped to one log span before the first interval. Hidden commits are counted over all `commits`
 * with inclusive bounds.
 */
export function computeDomain(
  timeline: readonly TimelinePoint[],
  commits: readonly CommitTime[],
  eligibleShas: ReadonlySet<string>,
): TimelineDomain | null {
  const first = timeline[0];
  const last = timeline[timeline.length - 1];
  if (first === undefined || last === undefined) return null;
  const bucketStartMs = Date.parse(first.bucketStartUtc);
  const bucketEndMs = Date.parse(last.bucketEndUtc);
  const logSpan = bucketEndMs - bucketStartMs;

  let startMs = bucketStartMs;
  let endMs = bucketEndMs;
  for (const commit of commits) {
    if (!eligibleShas.has(commit.sha)) continue;
    const at = Date.parse(commit.timestampUtc);
    if (at < startMs) startMs = at;
    if (at > endMs) endMs = at;
  }

  let clipped = false;
  if (endMs - startMs > DOMAIN_CLIP_FACTOR * logSpan) {
    clipped = true;
    startMs = bucketStartMs - logSpan;
    endMs = bucketEndMs;
  }

  let hiddenEarlier = 0;
  let hiddenLater = 0;
  for (const commit of commits) {
    const at = Date.parse(commit.timestampUtc);
    if (at < startMs) hiddenEarlier += 1;
    else if (at > endMs) hiddenLater += 1;
  }

  return { startMs, endMs, bucketStartMs, bucketEndMs, clipped, hiddenEarlier, hiddenLater };
}

export interface XScale {
  plotWidth: number;
  startMs: number;
  endMs: number;
  toX(ms: number): number;
  toMs(x: number): number;
}

export function createXScale(domain: Pick<TimelineDomain, 'startMs' | 'endMs'>, plotWidth: number): XScale {
  const span = domain.endMs - domain.startMs;
  return {
    plotWidth,
    startMs: domain.startMs,
    endMs: domain.endMs,
    toX: (ms) => ((ms - domain.startMs) / span) * plotWidth,
    toMs: (x) => domain.startMs + (x / plotWidth) * span,
  };
}

/** 0 sits on the baseline (`plotHeight`) and `yMax` at the top (0); `yMax` is at least 1. */
export function yForValue(value: number, yMax: number, plotHeight: number): number {
  const top = Math.max(1, yMax);
  return plotHeight - (value / top) * plotHeight;
}

export function bucketCenters(timeline: readonly TimelinePoint[]): number[] {
  return timeline.map((point) => (Date.parse(point.bucketStartUtc) + Date.parse(point.bucketEndUtc)) / 2);
}

/** `M x y L x y ...` with numbers rounded to two decimals; empty input yields an empty string. */
export function seriesPath(xs: readonly number[], ys: readonly number[]): string {
  const parts: string[] = [];
  for (let index = 0; index < xs.length; index += 1) {
    const x = xs[index];
    const y = ys[index];
    if (x === undefined || y === undefined) continue;
    parts.push(`${parts.length === 0 ? 'M' : 'L'}${round2(x)} ${round2(y)}`);
  }
  return parts.join(' ');
}

/** The closed wash under the series: baseline to the first point, along the series, back to the baseline. */
export function areaPath(xs: readonly number[], ys: readonly number[], baselineY: number): string {
  const firstX = xs[0];
  const lastX = xs[xs.length - 1];
  if (firstX === undefined || lastX === undefined) return '';
  const line = seriesPath(xs, ys).replace(/^M/, 'L');
  return `M${round2(firstX)} ${round2(baselineY)} ${line} L${round2(lastX)} ${round2(baselineY)} Z`;
}

export interface PlotRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PlotGeometry {
  linePath: string;
  areaPath: string;
  /** Always exactly one rect spanning the plot: the single pointer hit target. */
  overlays: PlotRect[];
}

/** The renderer draws the line, the wash and the pointer overlay only from this object. */
export function buildPlotGeometry(
  timeline: readonly TimelinePoint[],
  values: readonly number[],
  domain: Pick<TimelineDomain, 'startMs' | 'endMs'>,
  plotWidth: number,
  plotHeight: number,
  yMax: number,
): PlotGeometry {
  const scale = createXScale(domain, plotWidth);
  const xs = bucketCenters(timeline).map((center) => scale.toX(center));
  const ys = values.map((value) => yForValue(value, yMax, plotHeight));
  return {
    linePath: seriesPath(xs, ys),
    areaPath: areaPath(xs, ys, plotHeight),
    overlays: [{ x: 0, y: 0, width: plotWidth, height: plotHeight }],
  };
}

/** The onset window as an x range clamped to the plot, or null when absent or fully outside. */
export function onsetBand(
  scale: XScale,
  windowStartUtc: string | null,
  windowEndUtc: string | null,
  plotWidth: number,
): { x: number; width: number } | null {
  if (windowStartUtc === null || windowEndUtc === null) return null;
  const left = Math.max(0, scale.toX(Date.parse(windowStartUtc)));
  const right = Math.min(plotWidth, scale.toX(Date.parse(windowEndUtc)));
  if (!(right > left)) return null;
  return { x: left, width: right - left };
}

/** Binary search on bucket centres: before the first is 0, after the last is n-1, ties go to the earlier bucket. */
export function nearestBucketIndex(
  timeline: readonly TimelinePoint[],
  ms: number,
  centers: readonly number[] = bucketCenters(timeline),
): number {
  const count = centers.length;
  if (count === 0) return 0;
  let low = 0;
  let high = count - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    const center = centers[mid];
    if (center === undefined) break;
    if (center < ms) low = mid + 1;
    else high = mid;
  }
  // `low` is the first centre at or after `ms`; compare it with its predecessor.
  const after = centers[low];
  const before = low > 0 ? centers[low - 1] : undefined;
  if (after === undefined) return count - 1;
  if (before === undefined) return low;
  return ms - before <= after - ms ? low - 1 : low;
}

/** Pass precomputed `centers` from the pointer handler so a 10,000-interval hover stays O(log n). */
export function bucketIndexFromX(
  scale: XScale,
  timeline: readonly TimelinePoint[],
  x: number,
  centers: readonly number[] = bucketCenters(timeline),
): number {
  return nearestBucketIndex(timeline, scale.toMs(x), centers);
}
