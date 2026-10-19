import { describe, expect, it } from 'vitest';
import type { AnalysisStream, TimelinePoint } from '../../src/core/model';
import { findCase, toAnalysisInput } from '../../src/ui/cases';
import {
  areaPath,
  bucketIndexFromX,
  buildPlotGeometry,
  computeDomain,
  createXScale,
  nearestBucketIndex,
  onsetBand,
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
