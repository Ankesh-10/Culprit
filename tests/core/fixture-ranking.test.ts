import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AnalysisInput, AnalysisResult, SignalName } from '../../src/core/model';
import { SCORING_VERSION } from '../../src/core/model';
import { analyze, toAnalysisResult } from '../../src/core/pipeline';
import { SCORING_V1, SIGNAL_ORDER, round6, toMicro } from '../../src/core/scoring';
import { serializeCanonicalJson, serializeMarkdown } from '../../src/core/serialization';

const fixtureIds = ['checkout-outage', 'slow-burn', 'ambiguous'] as const;
type FixtureId = (typeof fixtureIds)[number];

function read(fixtureId: FixtureId, fileName: string): string {
  return readFileSync(new URL(`../../fixtures/incidents/${fixtureId}/${fileName}`, import.meta.url), 'utf8');
}

function fixtureInput(fixtureId: FixtureId): AnalysisInput {
  return {
    logs: { text: read(fixtureId, 'logs.jsonl'), format: 'jsonl', source: `fixtures/incidents/${fixtureId}/logs.jsonl` },
    history: { text: read(fixtureId, 'history.json'), format: 'culprit-json', source: `fixtures/incidents/${fixtureId}/history.json` },
    options: null,
  };
}

function resultFor(fixtureId: FixtureId): AnalysisResult {
  const outcome = analyze(fixtureInput(fixtureId));
  if (!outcome.ok) throw outcome.error;
  return toAnalysisResult(outcome.stream);
}

interface Manifest {
  expected: { onsetClass: string; confidence: string };
}

interface Expected {
  onset: { class: string; windowStartUtc: string; windowEndUtc: string };
}

function manifestFor(fixtureId: FixtureId): Manifest {
  return JSON.parse(read(fixtureId, 'manifest.json')) as Manifest;
}

function expectedFor(fixtureId: FixtureId): Expected {
  return JSON.parse(read(fixtureId, 'expected.json')) as Expected;
}

/**
 * Frozen golden projections for scoring-v1 (D-07: transcendental-free, round6 results).
 * Any scoring constant change must bump SCORING_VERSION and regenerate these literals and
 * tests/core/golden/ambiguous.canonical.json deliberately. Tests have no update mode.
 * Order inside the ambiguous near-tie carries no meaning (D-02); suspects are matched by SHA.
 */
const goldenProjections = {
  'checkout-outage': {
    status: 'ranked',
    eligibleCount: 2,
    band: 'high',
    labels: [],
    scoreSeparation: 0.368012,
    suspects: [
      { sha: '2222222', rank: 1, score: 0.912065, contributions: [0.315, 0.3, 0.25, 0.047065] },
      { sha: '1111111', rank: 2, score: 0.544053, contributions: [0.277083, 0, 0.25, 0.01697] },
    ],
    considered: [
      { sha: '1111111', status: 'top-three', rank: 2 },
      { sha: '2222222', status: 'top-three', rank: 1 },
      { sha: '3333333', status: 'excluded', rank: null },
    ],
  },
  'slow-burn': {
    status: 'ranked',
    eligibleCount: 3,
    band: 'medium',
    labels: [],
    scoreSeparation: 0.289046,
    suspects: [
      { sha: '5555555', rank: 1, score: 0.839323, contributions: [0.239167, 0.3, 0.25, 0.050156] },
      { sha: '6666666', rank: 2, score: 0.550277, contributions: [0.285833, 0, 0.25, 0.014444] },
      { sha: '4444444', rank: 3, score: 0.474871, contributions: [0.204167, 0, 0.25, 0.020704] },
    ],
    considered: [
      { sha: '4444444', status: 'top-three', rank: 3 },
      { sha: '5555555', status: 'top-three', rank: 1 },
      { sha: '6666666', status: 'top-three', rank: 2 },
    ],
  },
  ambiguous: {
    status: 'ranked',
    eligibleCount: 3,
    band: 'low',
    labels: ['low-confidence', 'ambiguous', 'weak-evidence', 'no-clear-culprit'],
    scoreSeparation: 0.012259,
    suspects: [
      { sha: '9999999', rank: 1, score: 0.575417, contributions: [0.317917, 0, 0.25, 0.0075] },
      { sha: '8888888', rank: 2, score: 0.563158, contributions: [0.28, 0, 0.25, 0.033158] },
      { sha: '7777777', rank: 3, score: 0.540694, contributions: [0.259583, 0, 0.25, 0.031111] },
    ],
    considered: [
      { sha: '7777777', status: 'top-three', rank: 3 },
      { sha: '8888888', status: 'top-three', rank: 2 },
      { sha: '9999999', status: 'top-three', rank: 1 },
    ],
  },
} as const;

function projection(result: AnalysisResult): unknown {
  return {
    status: result.ranking.status,
    eligibleCount: result.ranking.eligibleCount,
    band: result.confidence.band,
    labels: result.confidence.labels,
    scoreSeparation: result.confidence.scoreSeparation,
    suspects: result.suspects.map((suspect) => ({
      sha: suspect.shortSha,
      rank: suspect.rank,
      score: suspect.score,
      contributions: suspect.signals.map((signal) => signal.contribution),
    })),
    considered: [...result.ranking.considered]
      .sort((left, right) => (left.shortSha < right.shortSha ? -1 : left.shortSha > right.shortSha ? 1 : 0))
      .map((entry) => ({ sha: entry.shortSha, status: entry.status, rank: entry.rank })),
  };
}

describe('fixture ranking contract (FIX-02)', () => {
  it.each(fixtureIds)('ranks %s with the manifest band and structural invariants', (fixtureId) => {
    const result = resultFor(fixtureId);
    const manifest = manifestFor(fixtureId);

    expect(result.confidence.band).toBe(manifest.expected.confidence);
    expect(result.ranking.status).toBe('ranked');
    expect(result.suspects.length).toBeGreaterThan(0);
    expect(result.suspects.length).toBeLessThanOrEqual(3);
    expect(result.suspects.map((suspect) => suspect.rank)).toEqual(result.suspects.map((_, index) => index + 1));
    expect(result.ranking.considered.length).toBe(result.provenance.commitCount);
    for (const suspect of result.suspects) {
      expect(suspect.signals.map((signal) => signal.signal)).toEqual([...SIGNAL_ORDER]);
      expect(suspect.score).toBe(round6(suspect.signals.reduce((sum, signal) => sum + signal.contribution, 0)));
    }
  });

  it.each(fixtureIds)('pins the actual onset class and window of %s to expected.json', (fixtureId) => {
    const result = resultFor(fixtureId);
    const expected = expectedFor(fixtureId);
    const onset = result.incident.onset;

    expect(onset).not.toBeNull();
    expect(onset?.class).toBe(expected.onset.class);
    expect(onset?.class).toBe(manifestFor(fixtureId).expected.onsetClass);
    expect(Date.parse(onset?.windowStartUtc ?? '')).toBe(Date.parse(expected.onset.windowStartUtc));
    expect(Date.parse(onset?.windowEndUtc ?? '')).toBe(Date.parse(expected.onset.windowEndUtc));
  });

  it.each(fixtureIds)('matches the frozen golden projection for %s', (fixtureId) => {
    expect(projection(resultFor(fixtureId))).toEqual(goldenProjections[fixtureId]);
  });

  it.each(fixtureIds)('exports honest Markdown for %s', (fixtureId) => {
    const markdown = serializeMarkdown(resultFor(fixtureId));
    expect(markdown).toContain('not probability or proof of causality');
    expect(markdown).not.toMatch(/caused by|the culprit is|\d\s*%/i);
  });

  it('checkout: the culprit ranks first and the post-onset commit is excluded', () => {
    const result = resultFor('checkout-outage');
    expect(result.suspects[0]?.sha).toBe('2'.repeat(40));
    expect(result.suspects.map((suspect) => suspect.sha)).not.toContain('3'.repeat(40));
    const excluded = result.ranking.considered.find((entry) => entry.sha === '3'.repeat(40));
    expect(excluded?.status).toBe('excluded');
    expect(excluded?.reason).toContain('after');
    expect(result.incident.interpretation.startsWith('Commit 2222222 is the leading investigation target')).toBe(true);
  });

  it('slow-burn: the line-level culprit beats the nearest commit and no weak labels apply', () => {
    const result = resultFor('slow-burn');
    expect(result.suspects[0]?.sha).toBe('5'.repeat(40));
    expect(result.suspects[0]?.shortSha).not.toBe('6666666');
    expect(result.confidence.labels).not.toContain('ambiguous');
    expect(result.confidence.labels).not.toContain('weak-evidence');
    expect(result.incident.interpretation).toMatch(/gradual ramp/);
  });

  it('ambiguous: low-confidence near-tie with no trace evidence (no SHA required at rank 1)', () => {
    const result = resultFor('ambiguous');
    expect(result.confidence.labels).toEqual(['low-confidence', 'ambiguous', 'weak-evidence', 'no-clear-culprit']);
    expect(result.confidence.band).toBe('low');
    for (const suspect of result.suspects) {
      expect(suspect.signals.find((signal) => signal.signal === 'trace-match')?.contribution).toBe(0);
      expect(suspect.traceSummary.matchKind).toBe('none');
    }
    const first = result.suspects[0];
    const third = result.suspects[2];
    expect(toMicro(first?.score ?? 0) - toMicro(third?.score ?? 0)).toBeLessThan(50000);
    expect(result.suspects.map((suspect) => suspect.shortSha).sort()).toEqual(['7777777', '8888888', '9999999']);
    expect(result.incident.interpretation.startsWith('No clear culprit is established')).toBe(true);
  });

  it('matches the committed ambiguous golden file byte for byte', () => {
    const golden = readFileSync(new URL('./golden/ambiguous.canonical.json', import.meta.url), 'utf8');
    expect(serializeCanonicalJson(resultFor('ambiguous'))).toBe(golden.trimEnd());
  });
});

describe('frozen scoring constants (independent of any fixture)', () => {
  it('pins the frozen scoring constants', () => {
    expect(SCORING_VERSION).toBe('scoring-v1');
    expect([...SIGNAL_ORDER]).toEqual(['proximity', 'trace-match', 'novelty', 'churn']);
    expect(SIGNAL_ORDER.map((signal) => Math.round(SCORING_V1.weights[signal] * 100))).toEqual([35, 30, 25, 10]);
    expect(SCORING_V1.proximityHalfLifeMinutes).toBe(60);
    expect(SCORING_V1.churn).toEqual({ halfSaturationLines: 50, lineShare: 0.7, fileShare: 0.3, fileCap: 5 });
    expect(SCORING_V1.traceStrengthTenths).toEqual({ 'exact-line': 10, 'nearby-line': 6, 'file-only': 3, none: 0 });
    expect(SCORING_V1.thresholds.ambiguousSeparationMicro).toBe(50000);
    expect(SCORING_V1.thresholds.clearSeparationMicro).toBe(150000);
  });
});

/*
 * Hand-derived oracle for the ambiguous fixture (D-02). Derived from the fixture files and
 * the frozen formula, NOT by running the scoring module, so a golden file regenerated from
 * wrong code still fails here.
 *
 * Inputs (fixtures/incidents/ambiguous/history.json and logs.jsonl):
 *   Reference = actual onset window start 2026-10-19T10:06:00Z.
 *   Error events in UTC (the +01:00 offsets subtracted): 10:05 notebooks, 10:06 cameras,
 *   10:18 cameras, 10:24 tablets. Signature groups: notebooks (1 event, first seen 10:05),
 *   cameras (2, 10:06), tablets (1, 10:24). Every error's first frame is the vendor file
 *   node_modules/search-client/index.js; its top application frame is src/search/service.ts:63,
 *   which no commit changes, so trace = 0 for every commit. All 4 groups' errors are at or
 *   after every commit time (all commits are before 10:05), so novelty = 4/4 = 1.
 *
 * Formulas (scoring-v1): r6(x) = round(x * 1e6) / 1e6.
 *   proximity = r6(1 - (gap / 60) / 2) when gap < 60 minutes (no whole halvings)
 *   churn     = r6(0.7 * lines / (lines + 50) + 0.3 * min(1, (files - 1) / 4))
 *   contribution = r6(value * weight), weights 0.35 / 0.30 / 0.25 / 0.10
 *   score = r6(sum of the four contributions)
 *
 * 9999999 (package.json +3/-3, 1 file, 09:55): gap 11 min.
 *   proximity r6(109/120) = 0.908333 -> contribution r6(0.908333 * 0.35) = 0.317917
 *   trace 0 -> 0; novelty 1 -> 0.25; churn lines 6: r6(0.7 * 6 / 56) = 0.075 -> 0.0075
 *   score r6(0.317917 + 0 + 0.25 + 0.0075) = 0.575417
 * 8888888 (src/search/adapter.ts +27/-18, 1 file, 09:42): gap 24 min.
 *   proximity 1 - (24/60)/2 = 0.8 -> 0.28; trace 0; novelty 1 -> 0.25;
 *   churn lines 45: r6(0.7 * 45 / 95) = 0.331579 -> r6(0.0331579) = 0.033158
 *   score r6(0.28 + 0 + 0.25 + 0.033158) = 0.563158
 * 7777777 (src/search/cache.ts +31/-9, 1 file, 09:35): gap 31 min.
 *   proximity r6(89/120) = 0.741667 -> r6(0.741667 * 0.35) = 0.259583; trace 0;
 *   novelty 1 -> 0.25; churn lines 40: r6(0.7 * 40 / 90) = 0.311111 -> 0.031111
 *   score r6(0.259583 + 0 + 0.25 + 0.031111) = 0.540694
 * Confidence inputs: separation 575417 - 563158 = 12259 micro-units (< 50000, ambiguous);
 *   #1 minus #3 = 575417 - 540694 = 34723; 0 of 4 errors line-level (weak-evidence);
 *   all four errors have an application frame, so evidenceCompleteness = 1.
 */
const oracleInputs = [
  { sha: '9999999', gapMinutes: 11, lines: 6, files: 1 },
  { sha: '8888888', gapMinutes: 24, lines: 45, files: 1 },
  { sha: '7777777', gapMinutes: 31, lines: 40, files: 1 },
] as const;

const oracleLiterals: Record<string, { values: number[]; contributions: number[]; score: number }> = {
  '9999999': { values: [0.908333, 0, 1, 0.075], contributions: [0.317917, 0, 0.25, 0.0075], score: 0.575417 },
  '8888888': { values: [0.8, 0, 1, 0.331579], contributions: [0.28, 0, 0.25, 0.033158], score: 0.563158 },
  '7777777': { values: [0.741667, 0, 1, 0.311111], contributions: [0.259583, 0, 0.25, 0.031111], score: 0.540694 },
};

const oracleWeights = [0.35, 0.3, 0.25, 0.1];

function localRound6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/** Plain arithmetic recomputation: no import from the scoring module. */
function recompute(input: { gapMinutes: number; lines: number; files: number }): { values: number[]; contributions: number[]; score: number } {
  const proximity = localRound6((120 - input.gapMinutes) / 120);
  const trace = 0;
  const novelty = 4 / 4;
  const churn = localRound6((0.7 * input.lines) / (input.lines + 50) + 0.3 * Math.min(1, (input.files - 1) / 4));
  const values = [proximity, trace, novelty, churn];
  const contributions = values.map((value, index) => localRound6(value * (oracleWeights[index] ?? 0)));
  const score = localRound6(contributions[0]! + contributions[1]! + contributions[2]! + contributions[3]!);
  return { values, contributions, score };
}

interface SignalShape {
  signal: SignalName;
  value: number;
  weight: number;
  contribution: number;
}

interface SuspectShape {
  shortSha: string;
  score: number;
  signals: SignalShape[];
}

describe('ambiguous fixture: hand-derived oracle', () => {
  const live = resultFor('ambiguous');
  const golden = JSON.parse(readFileSync(new URL('./golden/ambiguous.canonical.json', import.meta.url), 'utf8')) as {
    suspects: SuspectShape[];
    confidence: { scoreSeparation: number; evidenceCompleteness: number };
  };

  it.each(oracleInputs)('recomputes $sha by hand and agrees with the literals', (input) => {
    const recomputed = recompute(input);
    const literal = oracleLiterals[input.sha]!;
    expect(recomputed.values).toEqual(literal.values);
    expect(recomputed.contributions).toEqual(literal.contributions);
    expect(recomputed.score).toBe(literal.score);
  });

  it.each(oracleInputs)('the live result for $sha carries the oracle numbers', (input) => {
    const literal = oracleLiterals[input.sha]!;
    const suspect = live.suspects.find((entry) => entry.shortSha === input.sha);
    expect(suspect).toBeDefined();
    expect(suspect?.signals.map((signal) => signal.signal)).toEqual([...SIGNAL_ORDER]);
    expect(suspect?.signals.map((signal) => signal.value)).toEqual(literal.values);
    expect(suspect?.signals.map((signal) => signal.weight)).toEqual(oracleWeights);
    expect(suspect?.signals.map((signal) => signal.contribution)).toEqual(literal.contributions);
    expect(suspect?.score).toBe(literal.score);
  });

  it.each(oracleInputs)('the committed golden file for $sha carries the oracle numbers', (input) => {
    const literal = oracleLiterals[input.sha]!;
    const suspect = golden.suspects.find((entry) => entry.shortSha === input.sha);
    expect(suspect).toBeDefined();
    expect(suspect?.signals.map((signal) => signal.signal)).toEqual([...SIGNAL_ORDER]);
    expect(suspect?.signals.map((signal) => signal.value)).toEqual(literal.values);
    expect(suspect?.signals.map((signal) => signal.weight)).toEqual(oracleWeights);
    expect(suspect?.signals.map((signal) => signal.contribution)).toEqual(literal.contributions);
    expect(suspect?.score).toBe(literal.score);
  });

  it('derives the confidence inputs from the same arithmetic', () => {
    const byScore = [...live.suspects].sort((left, right) => left.rank - right.rank);
    expect(toMicro(byScore[0]!.score) - toMicro(byScore[1]!.score)).toBe(12259);
    expect(toMicro(byScore[0]!.score) - toMicro(byScore[2]!.score)).toBe(34723);
    expect(live.confidence.evidenceCompleteness).toBe(1);
    expect(golden.confidence.scoreSeparation).toBe(0.012259);
    expect(golden.confidence.evidenceCompleteness).toBe(1);
  });
});
