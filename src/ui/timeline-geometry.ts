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

export type MarkerKind = 'leading' | 'ranked' | 'other';

export interface CommitMarker {
  sha: string;
  shortSha: string;
  kind: MarkerKind;
  rank: number | null;
  /** Diamond size in px: 16 leading, 12 ranked, 8 other. */
  size: number;
  label: string | null;
  x: number;
}

export interface SuspectRef {
  rank: number;
  sha: string;
  shortSha: string;
}

/** Commit-lane marks in commit-time order; commits outside the domain produce no marker. */
export function commitMarkers(
  scale: XScale,
  domain: Pick<TimelineDomain, 'startMs' | 'endMs'>,
  commits: readonly CommitTime[],
  suspects: readonly SuspectRef[],
): CommitMarker[] {
  const byShaRank = new Map(suspects.map((suspect) => [suspect.sha, suspect]));
  const placed = commits
    .map((commit) => ({ commit, at: Date.parse(commit.timestampUtc) }))
    .filter(({ at }) => at >= domain.startMs && at <= domain.endMs)
    .sort((left, right) => left.at - right.at || (left.commit.sha < right.commit.sha ? -1 : left.commit.sha > right.commit.sha ? 1 : 0));
  const markers = placed.map(({ commit, at }): CommitMarker => {
    const suspect = byShaRank.get(commit.sha);
    const shortSha = suspect?.shortSha ?? commit.sha.slice(0, 7);
    const x = scale.toX(at);
    if (suspect !== undefined && suspect.rank === 1) {
      return { sha: commit.sha, shortSha, kind: 'leading', rank: 1, size: 16, label: `#1 ${shortSha}`, x };
    }
    if (suspect !== undefined && (suspect.rank === 2 || suspect.rank === 3)) {
      return { sha: commit.sha, shortSha, kind: 'ranked', rank: suspect.rank, size: 12, label: `#${suspect.rank}`, x };
    }
    return { sha: commit.sha, shortSha, kind: 'other', rank: null, size: 8, label: null, x };
  });
  // Bound the lane: the top three are always drawn, and an 'other' marker only claims a pixel column that no
  // earlier marker holds. The full commit list stays in 'Commits considered' and the data table.
  const taken = new Set(markers.filter((marker) => marker.kind !== 'other').map((marker) => Math.round(marker.x)));
  return markers.filter((marker) => {
    if (marker.kind !== 'other') return true;
    const column = Math.round(marker.x);
    if (taken.has(column)) return false;
    taken.add(column);
    return true;
  });
}

export interface LabelCandidate {
  /** `onset`, `rank-1`, `rank-2`, `rank-3` or `peak`. */
  id: string;
  /** Lower wins: onset 0, "#1" 1, "#2"/"#3" 2, peak 3. */
  priority: number;
  /** Left edge of the label box. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export function estimateLabelWidth(text: string): number {
  return text.length * 8 + 8;
}

/** Moves a label box inside the plot rather than dropping it; a label wider than the plot starts at 0. */
export function clampLabelX(x: number, width: number, plotWidth: number): number {
  return Math.max(0, Math.min(x, plotWidth - width));
}

function intersects(left: LabelCandidate, right: LabelCandidate): boolean {
  return (
    left.x < right.x + right.width &&
    right.x < left.x + left.width &&
    left.y < right.y + right.height &&
    right.y < left.y + left.height
  );
}

function compareIds(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

/**
 * Labels are never nudged or stacked: in priority order (then left to right) each is clamped into the plot
 * and kept only when it does not intersect one already kept. A dropped label never removes its marker.
 */
export function resolveLabels(
  candidates: readonly LabelCandidate[],
  plotWidth: number,
  options: { dropRankLabels: boolean },
): Set<string> {
  const ordered = [...candidates].sort((a, b) => a.priority - b.priority || a.x - b.x || compareIds(a.id, b.id));
  const kept = new Set<string>();
  const keptBoxes: LabelCandidate[] = [];
  for (const candidate of ordered) {
    if (options.dropRankLabels && (candidate.id.startsWith('rank-2') || candidate.id.startsWith('rank-3'))) continue;
    const box = { ...candidate, x: clampLabelX(candidate.x, candidate.width, plotWidth) };
    if (keptBoxes.some((other) => intersects(box, other))) continue;
    keptBoxes.push(box);
    kept.add(candidate.id);
  }
  return kept;
}

export interface AxisTick {
  ms: number;
  /** `HH:MM` in UTC. */
  label: string;
}

/** `count` evenly spaced ticks from the domain start to its end, plus the UTC date shown once. */
export function computeTicks(
  domain: Pick<TimelineDomain, 'startMs' | 'endMs'>,
  count: number,
): { ticks: AxisTick[]; date: string } {
  const total = Math.max(1, Math.floor(count));
  const span = domain.endMs - domain.startMs;
  const ticks: AxisTick[] = [];
  for (let index = 0; index < total; index += 1) {
    const ms = total === 1 ? domain.startMs : Math.round(domain.startMs + (span * index) / (total - 1));
    ticks.push({ ms, label: new Date(ms).toISOString().slice(11, 16) });
  }
  return { ticks, date: new Date(domain.startMs).toISOString().slice(0, 10) };
}

function commitsOutside(count: number, side: 'earlier' | 'later'): string {
  return `${count} ${side} ${count === 1 ? 'commit is' : 'commits are'} outside this view; see Commits considered.`;
}

export function domainNote(domain: Pick<TimelineDomain, 'hiddenEarlier' | 'hiddenLater'>): string | null {
  const parts: string[] = [];
  if (domain.hiddenEarlier > 0) parts.push(commitsOutside(domain.hiddenEarlier, 'earlier'));
  if (domain.hiddenLater > 0) parts.push(commitsOutside(domain.hiddenLater, 'later'));
  return parts.length === 0 ? null : parts.join(' ');
}
