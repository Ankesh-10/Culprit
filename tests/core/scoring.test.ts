import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { AnalysisInput, AnalysisStream, ChangedFile, ErrorGroup, GitCommit, LogEvent } from '../../src/core/model';
import { buildEvidenceIndex } from '../../src/core/evidence';
import type { EvidenceIndex } from '../../src/core/evidence';
import { analyze } from '../../src/core/pipeline';
import {
  EVIDENCE_LIMITS,
  SCORING_V1,
  SIGNAL_ORDER,
  churnValue,
  proximityValue,
  round6,
  scoreCommit,
  toMicro,
} from '../../src/core/scoring';
import type { CommitScore } from '../../src/core/scoring';

function readFixture(id: string, name: string): string {
  return readFileSync(new URL(`../../fixtures/incidents/${id}/${name}`, import.meta.url), 'utf8');
}

function streamFor(id: string): AnalysisStream {
  const input: AnalysisInput = {
    logs: { text: readFixture(id, 'logs.jsonl'), format: 'jsonl', source: `fixtures/incidents/${id}/logs.jsonl` },
    history: { text: readFixture(id, 'history.json'), format: 'culprit-json', source: `fixtures/incidents/${id}/history.json` },
    options: null,
  };
  const outcome = analyze(input);
  if (!outcome.ok) throw outcome.error;
  return outcome.stream;
}

function commitStartingWith(stream: AnalysisStream, prefix: string): GitCommit {
  const commit = stream.commits.find((candidate) => candidate.sha.startsWith(prefix));
  if (commit === undefined) throw new Error(`fixture commit ${prefix} is missing`);
  return commit;
}

function scoreFixtureCommit(stream: AnalysisStream, index: EvidenceIndex, prefix: string): CommitScore {
  const reference = stream.onset.windowStartUtc;
  if (reference === null) throw new Error('fixture must have an onset window');
  return scoreCommit(commitStartingWith(stream, prefix), index, reference);
}

describe('scoring tracer: checkout fixture', () => {
  const stream = streamFor('checkout-outage');
  const index = buildEvidenceIndex(stream.normalizedEvents, stream.errors);

  it('indexes every error event by its top application frame', () => {
    expect(index.totalErrorEvents).toBe(5);
    expect(index.applicationFrameEvents).toBe(5);
  });

  it('scores the checkout culprit from the real fixture stream with all four signals', () => {
    const culprit = scoreFixtureCommit(stream, index, '2222222');
    expect(culprit.score).toBe(0.912065);
    expect(culprit.signals.map((signal) => signal.signal)).toEqual([...SIGNAL_ORDER]);
    expect(culprit.signals.map((signal) => signal.contribution)).toEqual([0.315, 0.3, 0.25, 0.047065]);
    expect(culprit.signals.map((signal) => signal.value)).toEqual([0.9, 1, 1, 0.470652]);
    expect(culprit.signals.map((signal) => signal.weight)).toEqual([0.35, 0.3, 0.25, 0.1]);
    expect(culprit.timeGapMinutes).toBe(12);
    expect(culprit.traceSummary).toEqual({
      matchKind: 'exact-line',
      matchedErrorCount: 5,
      lineLevelErrorCount: 5,
      totalErrorCount: 5,
    });
    for (const signal of culprit.signals) expect(signal.explanation.length).toBeGreaterThan(0);
    const traceReferences = culprit.signals[1]?.evidenceReferences ?? [];
    expect(traceReferences).toContainEqual(expect.objectContaining({
      type: 'file-range',
      path: 'src/checkout/payment.ts',
      lineStart: 104,
      lineEnd: 126,
    }));
  });

  it('gives the dashboard decoy no trace credit and explains why', () => {
    const decoy = scoreFixtureCommit(stream, index, '1111111');
    expect(decoy.score).toBe(0.544053);
    expect(decoy.traceValue).toBe(0);
    expect(decoy.traceSummary.matchKind).toBe('none');
    const trace = decoy.signals[1];
    expect(trace?.value).toBe(0);
    expect(trace?.explanation).toMatch(/No error event/);
  });
});

const BANNED_WORDS = /generated|caused by|the culprit is|%/i;
const REFERENCE = '2026-10-19T10:00:00.000Z';

function fileOf(path: string, added: number, deleted: number, start = 1, end = 1): ChangedFile {
  return { path, added, deleted, ranges: [{ start, end }] };
}

function commitOf(files: ChangedFile[], timestampUtc = '2026-10-19T09:00:00.000Z'): GitCommit {
  return {
    sha: 'b'.repeat(40),
    author: 'Dev',
    message: 'change',
    subject: 'change',
    timestampUtc,
    files,
    source: { source: 'test', line: null, record: null },
  };
}

function errorEvent(id: string, timestampUtc: string, filePath: string, line: number, vendor = false): LogEvent {
  return {
    eventId: id,
    timestampUtc,
    level: 'error',
    message: 'failure',
    rawMessage: 'failure',
    exception: 'Failure',
    stack: null,
    stackFrames: [{ filePath, line, column: 1, functionName: null, vendor }],
    source: { source: 'test', line: null, record: null },
    rawLine: '',
  };
}

function groupOf(signature: string, events: LogEvent[]): ErrorGroup {
  const first = events[0];
  const last = events.at(-1);
  if (first === undefined || last === undefined) throw new Error('group needs events');
  return {
    signature,
    representativeMessage: 'failure',
    count: events.length,
    firstSeenUtc: first.timestampUtc,
    lastSeenUtc: last.timestampUtc,
    eventIds: events.map((entry) => entry.eventId),
    stackFrames: [],
  };
}

function signalOf(score: CommitScore, name: string): CommitScore['signals'][number] {
  const signal = score.signals.find((entry) => entry.signal === name);
  if (signal === undefined) throw new Error(`missing signal ${name}`);
  return signal;
}

describe('frozen scoring model', () => {
  it('pins the proximity knots and keeps proximity non-increasing', () => {
    expect(proximityValue(0)).toBe(1);
    expect(proximityValue(-5)).toBe(1);
    expect(proximityValue(12)).toBe(0.9);
    expect(proximityValue(30)).toBe(0.75);
    expect(proximityValue(60)).toBe(0.5);
    expect(proximityValue(90)).toBe(0.375);
    expect(proximityValue(120)).toBe(0.25);
    expect(proximityValue(1_000_000)).toBe(0);
    let previous = proximityValue(0);
    for (let minute = 1; minute <= 600; minute += 1) {
      const value = proximityValue(minute);
      expect(value).toBeLessThanOrEqual(previous);
      previous = value;
    }
  });

  it('bounds churn and keeps it monotonic', () => {
    expect(churnValue(0, 0)).toBe(0);
    expect(churnValue(65, 2)).toBe(0.470652);
    expect(churnValue(16, 1)).toBe(0.169697);
    for (let lines = 0; lines < 400; lines += 20) {
      expect(churnValue(lines + 20, 3)).toBeGreaterThanOrEqual(churnValue(lines, 3));
    }
    for (let files = 0; files < 12; files += 1) {
      expect(churnValue(100, files + 1)).toBeGreaterThanOrEqual(churnValue(100, files));
    }
    // round6 can round a saturated value up to exactly 1, so the hard bound is <= 1 and the weight caps the contribution.
    expect(churnValue(10_000, 1000)).toBeLessThan(1);
    expect(churnValue(1e9, 1000)).toBeLessThanOrEqual(1);
    expect(round6(churnValue(1e9, 1000) * SCORING_V1.weights.churn)).toBeLessThanOrEqual(0.1);
  });

  it('freezes the weights as integer percentages that sum to one hundred', () => {
    const percents = Object.values(SCORING_V1.weights).map((weight) => Math.round(weight * 100));
    expect(percents).toEqual([35, 30, 25, 10]);
    expect(percents.reduce((sum, value) => sum + value, 0)).toBe(100);
    for (const frozen of [
      SCORING_V1,
      SCORING_V1.weights,
      SCORING_V1.traceStrengthTenths,
      SCORING_V1.churn,
      SCORING_V1.thresholds,
      SIGNAL_ORDER,
      EVIDENCE_LIMITS,
    ]) {
      expect(Object.isFrozen(frozen)).toBe(true);
    }
  });

  it('rounds to micro-units and never returns negative zero', () => {
    expect(round6(-0)).toBe(0);
    expect(Object.is(round6(-1e-9), 0)).toBe(true);
    expect(toMicro(0.912065)).toBe(912065);
    expect(Object.is(toMicro(-1e-9), 0)).toBe(true);
  });

  describe('golden fixture scores', () => {
    const golden: [string, [string, number, number[]][]][] = [
      ['checkout-outage', [
        ['2222222', 0.912065, [0.9, 1, 1, 0.470652]],
        ['1111111', 0.544053, [0.791667, 0, 1, 0.169697]],
      ]],
      ['slow-burn', [
        ['5555555', 0.839323, [0.683333, 1, 1, 0.501562]],
        ['6666666', 0.550277, [0.816667, 0, 1, 0.144444]],
        ['4444444', 0.474871, [0.583333, 0, 1, 0.207042]],
      ]],
      ['ambiguous', [
        ['9999999', 0.575417, [0.908333, 0, 1, 0.075]],
        ['8888888', 0.563158, [0.8, 0, 1, 0.331579]],
        ['7777777', 0.540694, [0.741667, 0, 1, 0.311111]],
      ]],
    ];

    for (const [id, commits] of golden) {
      it(`matches the golden values for ${id}`, () => {
        const stream = streamFor(id);
        const index = buildEvidenceIndex(stream.normalizedEvents, stream.errors);
        for (const [prefix, score, values] of commits) {
          const scored = scoreFixtureCommit(stream, index, prefix);
          expect(scored.score).toBe(score);
          expect(scored.signals.map((signal) => signal.value)).toEqual(values);
        }
      });
    }

    it('gives every ambiguous commit zero trace evidence', () => {
      const stream = streamFor('ambiguous');
      const index = buildEvidenceIndex(stream.normalizedEvents, stream.errors);
      for (const prefix of ['7777777', '8888888', '9999999']) {
        const scored = scoreFixtureCommit(stream, index, prefix);
        expect(scored.traceValue).toBe(0);
        expect(scored.traceSummary.matchKind).toBe('none');
      }
    });

    it('re-adds displayed contributions to the score and uses clean wording everywhere', () => {
      for (const id of ['checkout-outage', 'slow-burn', 'ambiguous']) {
        const stream = streamFor(id);
        const index = buildEvidenceIndex(stream.normalizedEvents, stream.errors);
        const reference = stream.onset.windowStartUtc;
        if (reference === null) throw new Error('fixture must have an onset window');
        for (const commit of stream.commits) {
          const scored = scoreCommit(commit, index, reference);
          expect(scored.score).toBe(round6(scored.signals.reduce((sum, signal) => sum + signal.contribution, 0)));
          for (const signal of scored.signals) {
            expect(signal.contribution).toBe(round6(signal.value * signal.weight));
            expect(signal.explanation.length).toBeGreaterThan(0);
            expect(signal.explanation).not.toMatch(BANNED_WORDS);
          }
        }
      }
    });
  });

  describe('missing evidence and boundaries', () => {
    it('ignores build-output files for churn and says so', () => {
      const index = buildEvidenceIndex([], []);
      const plain = scoreCommit(commitOf([fileOf('src/a.ts', 10, 0)]), index, REFERENCE);
      const withBundle = scoreCommit(
        commitOf([fileOf('src/a.ts', 10, 0), fileOf('dist/bundle.min.js', 5000, 5000)]),
        index,
        REFERENCE,
      );
      const churnPlain = signalOf(plain, 'churn');
      const churnBundle = signalOf(withBundle, 'churn');
      expect(churnBundle.value).toBe(churnPlain.value);
      expect(churnBundle.evidenceReferences.map((reference) => reference.path)).toEqual(['src/a.ts']);
      expect(churnBundle.explanation).toContain('1 build-output file was ignored');
      expect(churnBundle.explanation).toContain('1 file;');
      const onlyBuild = signalOf(scoreCommit(commitOf([fileOf('dist/app.js', 9, 9)]), index, REFERENCE), 'churn');
      expect(onlyBuild.value).toBe(0);
      expect(onlyBuild.explanation).toMatch(/build-output/);
    });

    it('explains zero trace and novelty when there are no error events', () => {
      const scored = scoreCommit(commitOf([fileOf('src/a.ts', 1, 1)]), buildEvidenceIndex([], []), REFERENCE);
      expect(signalOf(scored, 'trace-match').value).toBe(0);
      expect(signalOf(scored, 'trace-match').explanation).toMatch(/No error events/);
      expect(signalOf(scored, 'novelty').value).toBe(0);
      expect(signalOf(scored, 'novelty').explanation).toMatch(/No error events/);
    });

    it('explains unavailable trace evidence when no error has an application frame', () => {
      const vendorOnly = errorEvent('v1', '2026-10-19T09:30:00.000Z', 'node_modules/x/index.js', 3, true);
      const index = buildEvidenceIndex([vendorOnly], [groupOf('sig', [vendorOnly])]);
      const scored = scoreCommit(commitOf([fileOf('src/a.ts', 1, 1)]), index, REFERENCE);
      expect(signalOf(scored, 'trace-match').value).toBe(0);
      expect(signalOf(scored, 'trace-match').explanation).toMatch(/unavailable/);
      expect(signalOf(scored, 'novelty').value).toBe(1);
    });

    it('explains zero trace and churn for a commit that lists no files', () => {
      const crash = errorEvent('e1', '2026-10-19T09:30:00.000Z', 'src/a.ts', 3);
      const index = buildEvidenceIndex([crash], [groupOf('sig', [crash])]);
      const scored = scoreCommit(commitOf([]), index, REFERENCE);
      expect(signalOf(scored, 'trace-match').value).toBe(0);
      expect(signalOf(scored, 'trace-match').explanation).toMatch(/no changed files/);
      expect(signalOf(scored, 'churn').value).toBe(0);
      expect(signalOf(scored, 'churn').explanation).toMatch(/no changed files/);
    });

    it('gives zero novelty when every signature was present before the commit', () => {
      const early = errorEvent('e1', '2026-10-19T08:00:00.000Z', 'src/a.ts', 3);
      const index = buildEvidenceIndex([early], [groupOf('sig', [early])]);
      const scored = scoreCommit(commitOf([fileOf('src/a.ts', 1, 1, 3, 3)]), index, REFERENCE);
      expect(signalOf(scored, 'novelty').value).toBe(0);
      expect(signalOf(scored, 'novelty').explanation).toMatch(/already present/);
      expect(signalOf(scored, 'trace-match').value).toBe(0);
    });

    it('treats a commit at the reference time as gap zero and an event at the commit time as at-or-after', () => {
      const crash = errorEvent('e1', REFERENCE, 'src/a.ts', 3);
      const index = buildEvidenceIndex([crash], [groupOf('sig', [crash])]);
      const scored = scoreCommit(commitOf([fileOf('src/a.ts', 1, 1, 3, 3)], REFERENCE), index, REFERENCE);
      expect(scored.timeGapMinutes).toBe(0);
      expect(signalOf(scored, 'proximity').value).toBe(1);
      expect(signalOf(scored, 'trace-match').value).toBe(1);
      expect(signalOf(scored, 'novelty').value).toBe(1);
      const after = scoreCommit(commitOf([fileOf('src/a.ts', 1, 1, 3, 3)], '2026-10-19T10:05:00.000Z'), index, REFERENCE);
      expect(after.timeGapMinutes).toBe(0);
      expect(signalOf(after, 'proximity').value).toBe(1);
    });

    it('caps evidence references and rejects an invalid reference time', () => {
      const files = Array.from({ length: 9 }, (_, number) => fileOf(`src/f${number}.ts`, 1, 1));
      const scored = scoreCommit(commitOf(files), buildEvidenceIndex([], []), REFERENCE);
      expect(signalOf(scored, 'churn').evidenceReferences).toHaveLength(EVIDENCE_LIMITS.files);
      expect(() => scoreCommit(commitOf([]), buildEvidenceIndex([], []), 'not a time')).toThrow(/valid UTC timestamp/);
    });
  });

  describe('cross-engine arithmetic', () => {
    function stripComments(text: string): string {
      return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    }

    for (const name of ['scoring', 'evidence']) {
      it(`keeps src/core/${name}.ts free of exponentiation and transcendental math`, () => {
        const source = stripComments(readFileSync(new URL(`../../src/core/${name}.ts`, import.meta.url), 'utf8'));
        expect(source).not.toMatch(/\*\*/);
        expect(source).not.toMatch(/Math\.(?:exp|expm1|log|log1p|log2|log10|pow|hypot|cbrt)\b/);
      });
    }
  });
});
