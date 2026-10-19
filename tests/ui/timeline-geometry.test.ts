import { describe, expect, it } from 'vitest';
import type { AnalysisStream, TimelinePoint } from '../../src/core/model';
import { findCase, toAnalysisInput } from '../../src/ui/cases';
import {
  areaPath,
  bucketIndexFromX,
  buildPlotGeometry,
  clampLabelX,
  commitMarkers,
  computeDomain,
  computeTicks,
  createXScale,
  domainNote,
  estimateLabelWidth,
  nearestBucketIndex,
  onsetBand,
  resolveLabels,
  seriesPath,
  yForValue,
} from '../../src/ui/timeline-geometry';
import { handleAnalyzeRequest } from '../../src/worker/protocol';

function bundledStream(id: string): AnalysisStream {
  const found = findCase(id);
  if (found === undefined) throw new Error(`missing case ${id}`);
  const response = handleAnalyzeRequest({ type: 'analyze', requestId: 1, input: toAnalysisInput(found) });
  if (response.type !== 'result') throw new Error('expected a result');
  return response.stream;
}

const CHECKOUT = bundledStream('checkout-outage');

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

/** `count` back-to-back intervals of `minutes` minutes starting at `startIso`. */
function syntheticTimeline(startIso: string, count: number, minutes: number): TimelinePoint[] {
  const start = Date.parse(startIso);
  const width = minutes * 60_000;
  return Array.from({ length: count }, (_, index) => ({
    bucketStartUtc: iso(start + index * width),
    bucketEndUtc: iso(start + (index + 1) * width),
    errorCount: index % 7,
    errorGroupSignatures: [],
    commitShas: [],
  }));
}

function eligibleOf(stream: AnalysisStream): Set<string> {
  return new Set(stream.ranking.considered.filter((row) => row.status !== 'excluded').map((row) => row.sha));
}

describe('computeDomain', () => {
  it('spans the earliest eligible commit to the last interval for the checkout case', () => {
    const domain = computeDomain(CHECKOUT.timeline, CHECKOUT.commits, eligibleOf(CHECKOUT));
    expect(domain).not.toBeNull();
    expect(domain?.startMs).toBe(Date.parse('2026-10-19T04:05:00Z'));
    expect(domain?.endMs).toBe(Date.parse('2026-10-19T04:35:00Z'));
    expect(domain?.clipped).toBe(false);
    expect(domain?.hiddenEarlier).toBe(0);
    expect(domain?.hiddenLater).toBe(0);
  });

  it('returns null for an empty timeline', () => {
    expect(computeDomain([], [], new Set())).toBeNull();
  });

  it('clips to one log span before the first interval when the extension exceeds six log spans', () => {
    const timeline = syntheticTimeline('2026-10-19T12:00:00Z', 3, 5);
    const commits = [{ sha: 'early', timestampUtc: '2026-10-19T09:00:00Z' }];
    const domain = computeDomain(timeline, commits, new Set(['early']));
    expect(domain?.clipped).toBe(true);
    expect(domain?.startMs).toBe(Date.parse('2026-10-19T12:00:00Z') - 15 * 60_000);
    expect(domain?.endMs).toBe(Date.parse('2026-10-19T12:15:00Z'));
    expect(domain?.hiddenEarlier).toBe(1);
    expect(domain?.hiddenLater).toBe(0);
  });

  it('keeps an extension of exactly six log spans unclipped', () => {
    const timeline = syntheticTimeline('2026-10-19T12:00:00Z', 3, 5);
    const commits = [{ sha: 'edge', timestampUtc: iso(Date.parse('2026-10-19T12:15:00Z') - 6 * 15 * 60_000) }];
    const domain = computeDomain(timeline, commits, new Set(['edge']));
    expect(domain?.clipped).toBe(false);
  });
});

describe('scales', () => {
  it('round-trips time through x', () => {
    const scale = createXScale({ startMs: 1_000_000, endMs: 5_000_000 }, 640);
    for (const ms of [1_000_000, 2_345_678, 5_000_000]) {
      expect(scale.toMs(scale.toX(ms))).toBeCloseTo(ms, 6);
    }
    expect(scale.toX(1_000_000)).toBe(0);
    expect(scale.toX(5_000_000)).toBe(640);
  });

  it('puts zero on the baseline and the maximum at the top', () => {
    expect(yForValue(0, 4, 160)).toBe(160);
    expect(yForValue(4, 4, 160)).toBe(0);
    expect(yForValue(2, 4, 160)).toBe(80);
    expect(yForValue(0, 0, 160)).toBe(160);
    expect(yForValue(1, 0, 160)).toBe(0);
  });
});

describe('onsetBand', () => {
  it('places the checkout window at the right edge of the shared scale', () => {
    const domain = computeDomain(CHECKOUT.timeline, CHECKOUT.commits, eligibleOf(CHECKOUT));
    if (domain === null) throw new Error('expected a domain');
    const band = onsetBand(createXScale(domain, 1000), CHECKOUT.onset.windowStartUtc, CHECKOUT.onset.windowEndUtc, 1000);
    expect(band?.x).toBeCloseTo(833.33, 2);
    expect(band?.width).toBeCloseTo(166.67, 2);
  });

  it('is null without a window and clamps to the plot', () => {
    const scale = createXScale({ startMs: 0, endMs: 100 }, 100);
    expect(onsetBand(scale, null, null, 100)).toBeNull();
    const clamped = onsetBand(scale, '1970-01-01T00:00:00.000Z', '1970-01-01T00:00:00.200Z', 100);
    expect(clamped).toEqual({ x: 0, width: 100 });
    expect(onsetBand(scale, '1970-01-01T00:00:00.150Z', '1970-01-01T00:00:00.200Z', 100)).toBeNull();
  });
});

describe('nearestBucketIndex', () => {
  const timeline = syntheticTimeline('2026-10-19T04:00:00Z', 4, 5);
  const centerOf = (index: number): number => Date.parse('2026-10-19T04:00:00Z') + index * 300_000 + 150_000;

  it('clamps before the first and after the last centre', () => {
    expect(nearestBucketIndex(timeline, centerOf(0) - 10_000_000)).toBe(0);
    expect(nearestBucketIndex(timeline, centerOf(3) + 10_000_000)).toBe(3);
  });

  it('picks the nearest centre and sends ties to the earlier bucket', () => {
    expect(nearestBucketIndex(timeline, centerOf(1) + 100_000)).toBe(1);
    expect(nearestBucketIndex(timeline, centerOf(1) + 200_000)).toBe(2);
    expect(nearestBucketIndex(timeline, centerOf(1) + 150_000)).toBe(1);
    expect(nearestBucketIndex(timeline, centerOf(2))).toBe(2);
  });

  it('resolves an x position through the scale', () => {
    const domain = computeDomain(timeline, [], new Set());
    if (domain === null) throw new Error('expected a domain');
    const scale = createXScale(domain, 400);
    expect(bucketIndexFromX(scale, timeline, 0)).toBe(0);
    expect(bucketIndexFromX(scale, timeline, 400)).toBe(3);
    expect(bucketIndexFromX(scale, timeline, scale.toX(centerOf(2)))).toBe(2);
  });
});

describe('paths', () => {
  it('emits deterministic, two-decimal path strings', () => {
    expect(seriesPath([0, 10.456, 20], [5, 2.5, 0])).toBe('M0 5 L10.46 2.5 L20 0');
    expect(areaPath([0, 10], [5, 2.5], 8)).toBe('M0 8 L0 5 L10 2.5 L10 8 Z');
    expect(seriesPath([], [])).toBe('');
    expect(areaPath([], [], 8)).toBe('');
  });

  it('draws a 10,000-interval timeline as one line path, one area path and one overlay', () => {
    const timeline = syntheticTimeline('2026-10-19T00:00:00Z', 10_000, 1);
    const domain = computeDomain(timeline, [], new Set());
    if (domain === null) throw new Error('expected a domain');
    const values = timeline.map((point) => point.errorCount);
    const geometry = buildPlotGeometry(timeline, values, domain, 960, 160, 6);

    expect(geometry.linePath.match(/M/g)?.length).toBe(1);
    expect(geometry.linePath.match(/L/g)?.length).toBe(9_999);
    expect(typeof geometry.areaPath).toBe('string');
    expect(geometry.areaPath.startsWith('M')).toBe(true);
    expect(geometry.areaPath.endsWith('Z')).toBe(true);
    expect(geometry.overlays).toEqual([{ x: 0, y: 0, width: 960, height: 160 }]);
    expect(Object.keys(geometry).sort()).toEqual(['areaPath', 'linePath', 'overlays']);

    expect(buildPlotGeometry(timeline, values, domain, 960, 160, 6)).toEqual(geometry);
  });
});

describe('commitMarkers', () => {
  const domain = computeDomain(CHECKOUT.timeline, CHECKOUT.commits, eligibleOf(CHECKOUT));
  if (domain === null) throw new Error('expected a domain');
  const scale = createXScale(domain, 1000);

  it('marks the checkout commits in commit-time order with rank-driven kind, size and label', () => {
    const markers = commitMarkers(scale, domain, CHECKOUT.commits, CHECKOUT.ranking.suspects);
    expect(markers.map((marker) => marker.shortSha)).toEqual(['1111111', '2222222', '3333333']);
    expect(markers.map((marker) => [marker.kind, marker.rank, marker.size, marker.label])).toEqual([
      ['ranked', 2, 12, '#2'],
      ['leading', 1, 16, '#1 2222222'],
      ['other', null, 8, null],
    ]);
    expect(markers[0]?.x).toBeCloseTo(0, 2);
    expect(markers[1]?.x).toBeCloseTo(433.33, 2);
    expect(markers[2]?.x).toBeCloseTo(1000, 2);
  });

  it('produces no marker for a commit outside the domain', () => {
    const outside = [
      ...CHECKOUT.commits,
      { sha: 'f'.repeat(40), timestampUtc: '2026-10-19T03:00:00.000Z' },
      { sha: 'e'.repeat(40), timestampUtc: '2026-10-19T05:00:00.000Z' },
    ];
    expect(commitMarkers(scale, domain, outside, CHECKOUT.ranking.suspects)).toHaveLength(3);
  });

  it('labels a third-ranked suspect "#3" and keeps rank four and below unlabeled', () => {
    const commits = [1, 2, 3, 4].map((rank) => ({
      sha: String(rank).repeat(40),
      timestampUtc: iso(domain.startMs + rank * 60_000),
    }));
    const suspects = [1, 2, 3, 4].map((rank) => ({ rank, sha: String(rank).repeat(40), shortSha: String(rank).repeat(7) }));
    const result = commitMarkers(scale, domain, commits, suspects);
    expect(result.map((marker) => marker.label)).toEqual(['#1 1111111', '#2', '#3', null]);
    expect(result.map((marker) => marker.kind)).toEqual(['leading', 'ranked', 'ranked', 'other']);
    expect(result[3]?.rank).toBeNull();
  });
});

describe('resolveLabels', () => {
  const box = (id: string, priority: number, x: number, y = 0, width = 90, height = 18) => ({ id, priority, x, y, width, height });

  it('keeps only the higher-priority label of an intersecting pair', () => {
    const kept = resolveLabels([box('rank-1', 1, 830), box('onset', 0, 800)], 1000, { dropRankLabels: false });
    expect([...kept]).toEqual(['onset']);
  });

  it('keeps every label that does not overlap', () => {
    const kept = resolveLabels([box('onset', 0, 0), box('rank-1', 1, 200), box('peak', 3, 400, 40)], 1000, { dropRankLabels: false });
    expect([...kept].sort()).toEqual(['onset', 'peak', 'rank-1']);
  });

  it('clamps a label near the right edge inside the plot instead of dropping it', () => {
    const kept = resolveLabels([box('rank-1', 1, 990, 0, 100)], 1000, { dropRankLabels: false });
    expect(kept.has('rank-1')).toBe(true);
    expect(clampLabelX(990, 100, 1000)).toBe(900);
    expect(clampLabelX(-20, 100, 1000)).toBe(0);
    expect(clampLabelX(10, 2000, 1000)).toBe(0);
  });

  it('applies the clamp before testing for overlap', () => {
    const kept = resolveLabels([box('onset', 0, 950, 0, 100), box('rank-1', 1, 960, 0, 100)], 1000, { dropRankLabels: false });
    expect([...kept]).toEqual(['onset']);
  });

  it('never keeps "#2" or "#3" when rank labels are dropped', () => {
    const candidates = [box('rank-1', 1, 0), box('rank-2', 2, 200), box('rank-3', 2, 400), box('peak', 3, 600)];
    expect([...resolveLabels(candidates, 1000, { dropRankLabels: true })].sort()).toEqual(['peak', 'rank-1']);
    expect([...resolveLabels(candidates, 1000, { dropRankLabels: false })].sort()).toEqual(['peak', 'rank-1', 'rank-2', 'rank-3']);
  });

  it('estimates label width from text length', () => {
    expect(estimateLabelWidth('#2')).toBe(24);
    expect(estimateLabelWidth('Onset window')).toBe(104);
  });
});

describe('computeTicks', () => {
  const domain = { startMs: Date.parse('2026-10-19T04:05:00Z'), endMs: Date.parse('2026-10-19T04:35:00Z') };

  it('returns the requested count from the domain start to its end with HH:MM labels', () => {
    for (const count of [3, 4, 6]) {
      const { ticks } = computeTicks(domain, count);
      expect(ticks).toHaveLength(count);
      expect(ticks[0]?.ms).toBe(domain.startMs);
      expect(ticks[count - 1]?.ms).toBe(domain.endMs);
    }
    expect(computeTicks(domain, 3).ticks.map((tick) => tick.label)).toEqual(['04:05', '04:20', '04:35']);
    expect(computeTicks(domain, 6).ticks.map((tick) => tick.label)).toEqual(['04:05', '04:11', '04:17', '04:23', '04:29', '04:35']);
  });

  it('reports the UTC date once', () => {
    expect(computeTicks(domain, 4).date).toBe('2026-10-19');
  });
});

describe('domainNote', () => {
  it('is null when nothing is hidden (checkout)', () => {
    const domain = computeDomain(CHECKOUT.timeline, CHECKOUT.commits, eligibleOf(CHECKOUT));
    if (domain === null) throw new Error('expected a domain');
    expect(domainNote(domain)).toBeNull();
  });

  it('names an earlier commit hidden by the clip', () => {
    const timeline = syntheticTimeline('2026-10-19T12:00:00Z', 3, 5);
    const commits = [{ sha: 'early', timestampUtc: '2026-10-19T09:00:00Z' }];
    const domain = computeDomain(timeline, commits, new Set(['early']));
    if (domain === null) throw new Error('expected a domain');
    expect(domainNote(domain)).toBe('1 earlier commit is outside this view; see Commits considered.');
  });

  it('names a later commit after the last interval and agrees in the plural', () => {
    const timeline = syntheticTimeline('2026-10-19T12:00:00Z', 3, 5);
    const later = [{ sha: 'late', timestampUtc: '2026-10-19T12:20:00Z' }];
    const domain = computeDomain(timeline, later, new Set());
    if (domain === null) throw new Error('expected a domain');
    expect(domainNote(domain)).toBe('1 later commit is outside this view; see Commits considered.');
    expect(domainNote({ hiddenEarlier: 2, hiddenLater: 0 })).toBe('2 earlier commits are outside this view; see Commits considered.');
    expect(domainNote({ hiddenEarlier: 1, hiddenLater: 3 })).toBe(
      '1 earlier commit is outside this view; see Commits considered. 3 later commits are outside this view; see Commits considered.',
    );
  });
});
