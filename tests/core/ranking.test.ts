import { describe, expect, it } from 'vitest';
import type {
  ChangedFile,
  ErrorGroup,
  GitCommit,
  LogEvent,
  OnsetClass,
  RankingOutcome,
  StackFrame,
} from '../../src/core/model';
import { compareRanked, deriveConfidence, rankSuspects } from '../../src/core/ranking';
import type { ConfidenceInput, RankedKey, RankingInput } from '../../src/core/ranking';

const ONSET = '2026-10-19T04:30:00.000Z';

function hex(digit: string): string {
  return digit.repeat(40);
}

function file(path: string, ranges: { start: number; end: number }[] = [{ start: 10, end: 20 }], added = 5, deleted = 2): ChangedFile {
  return { path, added, deleted, ranges };
}

function commit(sha: string, timestampUtc: string, files: ChangedFile[]): GitCommit {
  return {
    sha,
    author: 'Test Author',
    message: `change ${sha.slice(0, 7)}`,
    subject: `change ${sha.slice(0, 7)}`,
    timestampUtc,
    files,
    source: { source: 'test', line: null, record: null },
  };
}

function frame(path: string, line: number): StackFrame {
  return { filePath: path, line, column: null, functionName: null, vendor: false };
}

function errorEvent(id: string, timestampUtc: string, frames: StackFrame[]): LogEvent {
  return {
    eventId: id,
    timestampUtc,
    level: 'error',
    message: 'request failed',
    rawMessage: 'request failed',
    exception: null,
    stack: null,
    stackFrames: frames,
    source: { source: 'test', line: null, record: null },
    rawLine: 'request failed',
  };
}

function group(signature: string, events: LogEvent[]): ErrorGroup {
  const times = events.map((event) => event.timestampUtc).sort();
  return {
    signature,
    representativeMessage: 'request failed',
    count: events.length,
    firstSeenUtc: times[0] ?? ONSET,
    lastSeenUtc: times.at(-1) ?? ONSET,
    eventIds: events.map((event) => event.eventId).sort(),
    stackFrames: events.flatMap((event) => event.stackFrames),
  };
}

function onset(cls: OnsetClass, windowStartUtc: string | null): RankingInput['onset'] {
  return { class: cls, windowStartUtc };
}

const PAYMENT = 'src/pay/charge.ts';

/** Three errors whose top application frame is inside the changed range of PAYMENT. */
function exactLineErrors(): { events: LogEvent[]; errors: ErrorGroup[] } {
  const events = [
    errorEvent('e1', '2026-10-19T04:30:00.000Z', [frame(PAYMENT, 15)]),
    errorEvent('e2', '2026-10-19T04:31:00.000Z', [frame(PAYMENT, 15)]),
    errorEvent('e3', '2026-10-19T04:32:00.000Z', [frame(PAYMENT, 15)]),
  ];
  return { events, errors: [group('charge failed', events)] };
}

function singleCommitSpike(): RankingOutcome {
  const { events, errors } = exactLineErrors();
  return rankSuspects({
    commits: [commit(hex('1'), '2026-10-19T04:20:00.000Z', [file(PAYMENT)])],
    events,
    errors,
    onset: onset('spike', ONSET),
  });
}

function fiveCommitInput(): RankingInput {
  const events = [
    errorEvent('e1', '2026-10-19T04:30:00.000Z', [frame(PAYMENT, 15)]),
    errorEvent('e2', '2026-10-19T04:31:00.000Z', [frame(PAYMENT, 15)]),
    errorEvent('e3', '2026-10-19T04:32:00.000Z', [frame('src/pay/refund.ts', 40)]),
    errorEvent('e4', '2026-10-19T04:33:00.000Z', []),
  ];
  const errors = [
    group('charge failed', events.slice(0, 2)),
    group('refund failed', events.slice(2, 3)),
    group('unknown failure', events.slice(3)),
  ];
  const commits = [
    commit(hex('1'), '2026-10-19T04:29:00.000Z', [file(PAYMENT)]),
    commit(hex('2'), '2026-10-19T04:25:00.000Z', [file('src/pay/refund.ts', [{ start: 38, end: 44 }])]),
    commit(hex('3'), '2026-10-19T04:10:00.000Z', [file(PAYMENT, [{ start: 100, end: 110 }])]),
    commit(hex('4'), '2026-10-19T03:30:00.000Z', [file('src/other/a.ts')]),
    commit(hex('5'), '2026-10-19T02:00:00.000Z', [file('src/other/b.ts')]),
  ];
  return { commits, events, errors, onset: onset('spike', ONSET) };
}

function noStackInput(): RankingInput {
  const events = [
    errorEvent('e1', '2026-10-19T04:30:00.000Z', []),
    errorEvent('e2', '2026-10-19T04:31:00.000Z', []),
  ];
  return {
    commits: [commit(hex('1'), '2026-10-19T04:20:00.000Z', [file(PAYMENT)])],
    events,
    errors: [group('opaque failure', events)],
    onset: onset('spike', ONSET),
  };
}

/** A clear score gap from proximity alone, with application frames that match no changed file. */
function clearButUntracedInput(): RankingInput {
  const events = [
    errorEvent('e1', '2026-10-19T04:30:00.000Z', [frame('src/other/x.ts', 3)]),
    errorEvent('e2', '2026-10-19T04:31:00.000Z', [frame('src/other/x.ts', 3)]),
  ];
  return {
    commits: [
      commit(hex('1'), '2026-10-19T04:30:00.000Z', [file(PAYMENT)]),
      commit(hex('2'), '2026-10-19T00:30:00.000Z', [file(PAYMENT)]),
    ],
    events,
    errors: [group('x failed', events)],
    onset: onset('spike', ONSET),
  };
}

function noOnsetInput(cls: OnsetClass): RankingInput {
  const { events, errors } = exactLineErrors();
  return {
    commits: [commit(hex('1'), '2026-10-19T04:20:00.000Z', [file(PAYMENT)])],
    events,
    errors,
    onset: onset(cls, null),
  };
}

function noEligibleInput(): RankingInput {
  const { events, errors } = exactLineErrors();
  return {
    commits: [
      commit(hex('1'), '2026-10-19T04:30:00.001Z', [file(PAYMENT)]),
      commit(hex('2'), '2026-10-19T05:00:00.000Z', [file(PAYMENT)]),
    ],
    events,
    errors,
    onset: onset('spike', ONSET),
  };
}

function ambiguousOnsetInput(): RankingInput {
  const { events, errors } = exactLineErrors();
  return {
    commits: [
      commit(hex('1'), '2026-10-19T04:20:00.000Z', [file(PAYMENT)]),
      commit(hex('2'), '2026-10-19T04:20:00.000Z', [file(PAYMENT)]),
    ],
    events,
    errors,
    onset: onset('ambiguous', ONSET),
  };
}

function ambiguousUntracedInput(): RankingInput {
  const events = [
    errorEvent('e1', '2026-10-19T04:30:00.000Z', [frame('src/other/x.ts', 3)]),
    errorEvent('e2', '2026-10-19T04:31:00.000Z', [frame('src/other/x.ts', 3)]),
  ];
  return {
    commits: [
      commit(hex('1'), '2026-10-19T04:20:00.000Z', [file(PAYMENT)]),
      commit(hex('2'), '2026-10-19T04:20:00.000Z', [file(PAYMENT)]),
    ],
    events,
    errors: [group('x failed', events)],
    onset: onset('ambiguous', ONSET),
  };
}

function rampInput(): RankingInput {
  const { events, errors } = exactLineErrors();
  return { ...fiveCommitInputWith(events, errors), onset: onset('ramp', ONSET) };
}

function fiveCommitInputWith(events: LogEvent[], errors: ErrorGroup[]): RankingInput {
  return {
    commits: [
      commit(hex('1'), '2026-10-19T04:29:00.000Z', [file(PAYMENT)]),
      commit(hex('2'), '2026-10-19T02:00:00.000Z', [file('src/other/a.ts')]),
    ],
    events,
    errors,
    onset: onset('spike', ONSET),
  };
}

const BASE: ConfidenceInput = {
  status: 'ranked',
  onsetClass: 'spike',
  separationMicro: 200000,
  lineLevelErrorCount: 4,
  applicationFrameEvents: 4,
  totalErrorEvents: 4,
};

function derive(overrides: Partial<ConfidenceInput>): ReturnType<typeof deriveConfidence> {
  return deriveConfidence({ ...BASE, ...overrides });
}

describe('compareRanked total order', () => {
  const key = (overrides: Partial<RankedKey>): RankedKey => ({ scoreMicro: 500000, traceMicro: 300000, committedEpoch: 1000, sha: hex('b'), ...overrides });

  it('orders by score, then trace, then later commit time, then SHA ascending', () => {
    expect(compareRanked(key({ scoreMicro: 600000 }), key({}))).toBeLessThan(0);
    expect(compareRanked(key({}), key({ scoreMicro: 600000 }))).toBeGreaterThan(0);
    expect(compareRanked(key({ traceMicro: 400000 }), key({}))).toBeLessThan(0);
    expect(compareRanked(key({ committedEpoch: 2000 }), key({}))).toBeLessThan(0);
    expect(compareRanked(key({ sha: hex('a') }), key({}))).toBeLessThan(0);
    expect(compareRanked(key({}), key({ sha: hex('a') }))).toBeGreaterThan(0);
    expect(compareRanked(key({}), key({}))).toBe(0);
  });

  it('lets an earlier tie-break field win over a later one', () => {
    const highScoreOldLowSha = key({ scoreMicro: 600000, committedEpoch: 1, sha: hex('a') });
    const lowScoreNewHighSha = key({ scoreMicro: 500000, committedEpoch: 9999, sha: hex('f') });
    expect(compareRanked(highScoreOldLowSha, lowScoreNewHighSha)).toBeLessThan(0);
  });
});

describe('rankSuspects ordering and eligibility', () => {
  it('ranks identical-score commits by SHA ascending and records the tie-break key', () => {
    const { events, errors } = exactLineErrors();
    const files = [file(PAYMENT)];
    const outcome = rankSuspects({
      commits: [commit(hex('b'), '2026-10-19T04:20:00.000Z', files), commit(hex('a'), '2026-10-19T04:20:00.000Z', files)],
      events,
      errors,
      onset: onset('spike', ONSET),
    });
    expect(outcome.suspects.map((suspect) => suspect.sha)).toEqual([hex('a'), hex('b')]);
    expect(outcome.suspects[0]?.score).toBe(outcome.suspects[1]?.score);
    for (const suspect of outcome.suspects) {
      const traceValue = suspect.signals.find((signal) => signal.signal === 'trace-match')?.value;
      expect(suspect.tieBreakKey).toBe([String(suspect.score), String(traceValue), suspect.committedAtUtc, suspect.sha].join('|'));
    }
    expect(outcome.confidence.scoreSeparation).toBe(0);
    expect(outcome.confidence.labels).toContain('ambiguous');
  });

  it('treats a commit exactly at the window start as eligible with a full proximity value', () => {
    const { events, errors } = exactLineErrors();
    const outcome = rankSuspects({
      commits: [commit(hex('1'), ONSET, [file(PAYMENT)])],
      events,
      errors,
      onset: onset('spike', ONSET),
    });
    expect(outcome.status).toBe('ranked');
    expect(outcome.suspects).toHaveLength(1);
    expect(outcome.suspects[0]?.timeGapMinutes).toBe(0);
    expect(outcome.suspects[0]?.signals.find((signal) => signal.signal === 'proximity')?.value).toBe(1);
  });

  it('excludes a commit one millisecond after the window start with an explanatory reason', () => {
    const { events, errors } = exactLineErrors();
    const outcome = rankSuspects({
      commits: [commit(hex('1'), ONSET, [file(PAYMENT)]), commit(hex('2'), '2026-10-19T04:30:00.001Z', [file(PAYMENT)])],
      events,
      errors,
      onset: onset('spike', ONSET),
    });
    expect(outcome.eligibleCount).toBe(1);
    expect(outcome.suspects.map((suspect) => suspect.sha)).toEqual([hex('1')]);
    const late = outcome.considered.find((entry) => entry.sha === hex('2'));
    expect(late?.status).toBe('excluded');
    expect(late?.rank).toBeNull();
    expect(late?.score).toBeNull();
    expect(late?.reason).toContain('after');
  });

  it('returns byte-identical output when commits, events and errors are reversed', () => {
    const input = fiveCommitInput();
    const reversed: RankingInput = {
      commits: [...input.commits].reverse(),
      events: [...input.events].reverse(),
      errors: [...input.errors].reverse(),
      onset: input.onset,
    };
    expect(JSON.stringify(rankSuspects(reversed))).toBe(JSON.stringify(rankSuspects(input)));
  });

  it('caps suspects at three and keeps remaining eligible commits as scored with their ranks', () => {
    const outcome = rankSuspects(fiveCommitInput());
    expect(outcome.eligibleCount).toBe(5);
    expect(outcome.suspects.map((suspect) => suspect.rank)).toEqual([1, 2, 3]);
    expect(outcome.considered).toHaveLength(5);
    const scored = outcome.considered.filter((entry) => entry.status === 'scored');
    expect(scored.map((entry) => entry.rank).sort()).toEqual([4, 5]);
    expect(scored.every((entry) => entry.score !== null && entry.reason === null)).toBe(true);
    expect(outcome.considered.filter((entry) => entry.status === 'top-three').map((entry) => entry.rank).sort()).toEqual([1, 2, 3]);
    const scores = [...outcome.considered].sort((left, right) => (left.rank ?? 0) - (right.rank ?? 0)).map((entry) => entry.score ?? 0);
    expect([...scores].sort((left, right) => right - left)).toEqual(scores);
  });

  it('reports no separation and a medium band for a single exactly traced commit on a spike', () => {
    const outcome = singleCommitSpike();
    expect(outcome.status).toBe('ranked');
    expect(outcome.suspects).toHaveLength(1);
    expect(outcome.suspects[0]?.traceSummary.matchKind).toBe('exact-line');
    expect(outcome.confidence.scoreSeparation).toBeNull();
    expect(outcome.confidence.band).toBe('medium');
    expect(outcome.confidence.labels).toEqual([]);
    expect(outcome.confidence.rationale).not.toMatch(/separat/i);
    expect(outcome.confidence.rationale).toContain('Only one eligible commit');
  });
});

describe('deriveConfidence thresholds', () => {
  it('is high when every threshold is cleared', () => {
    const result = derive({});
    expect(result.band).toBe('high');
    expect(result.labels).toEqual([]);
    expect(result.scoreSeparation).toBe(0.2);
    expect(result.evidenceCompleteness).toBe(1);
  });

  it('treats a 49999 micro separation as ambiguous and 50000 as not ambiguous', () => {
    const tight = derive({ separationMicro: 49999 });
    expect(tight.labels).toContain('ambiguous');
    expect(tight.band).toBe('low');
    expect(tight.scoreSeparation).toBe(0.049999);
    const edge = derive({ separationMicro: 50000 });
    expect(edge.labels).not.toContain('ambiguous');
    expect(edge.band).toBe('medium');
  });

  it('caps the band at medium below 150000 and allows high at 150000', () => {
    expect(derive({ separationMicro: 149999 }).band).toBe('medium');
    expect(derive({ separationMicro: 150000 }).band).toBe('high');
  });

  it('treats 1 of 2 line-level matches as not weak and 0 of 2 as weak', () => {
    const half = derive({ lineLevelErrorCount: 1, applicationFrameEvents: 2, totalErrorEvents: 2 });
    expect(half.labels).not.toContain('weak-evidence');
    const none = derive({ lineLevelErrorCount: 0, applicationFrameEvents: 2, totalErrorEvents: 2 });
    expect(none.labels).toContain('weak-evidence');
    expect(none.band).toBe('low');
    expect(none.rationale).toMatch(/weak/);
  });

  it('treats zero application frames as weak evidence', () => {
    const result = derive({ lineLevelErrorCount: 0, applicationFrameEvents: 0, totalErrorEvents: 4 });
    expect(result.labels).toContain('weak-evidence');
    expect(result.evidenceCompleteness).toBe(0);
    expect(result.rationale).toContain('no application stack frame');
  });

  it('caps the band when fewer than three quarters of events carry an application frame', () => {
    const covered = derive({ lineLevelErrorCount: 3, applicationFrameEvents: 3, totalErrorEvents: 4 });
    expect(covered.band).toBe('high');
    const partial = derive({ lineLevelErrorCount: 2, applicationFrameEvents: 2, totalErrorEvents: 4 });
    expect(partial.band).toBe('medium');
    expect(partial.labels).toEqual([]);
    expect(partial.rationale).toContain('2 of 4');
  });

  it('caps a ramp onset at medium', () => {
    const result = derive({ onsetClass: 'ramp' });
    expect(result.band).toBe('medium');
    expect(result.rationale).toContain('gradual ramp');
  });

  it('adds the ambiguous label for an ambiguous onset even with a large separation', () => {
    const result = derive({ onsetClass: 'ambiguous', separationMicro: 900000 });
    expect(result.labels).toContain('ambiguous');
    expect(result.labels).toContain('low-confidence');
    expect(result.labels).not.toContain('no-clear-culprit');
    expect(result.band).toBe('low');
  });

  it('adds no-clear-culprit only when ambiguous and weak coincide, in fixed label order', () => {
    const result = derive({ onsetClass: 'ambiguous', lineLevelErrorCount: 0 });
    expect(result.labels).toEqual(['low-confidence', 'ambiguous', 'weak-evidence', 'no-clear-culprit']);
  });

  it('always closes with the ranked-suspicion disclaimer', () => {
    for (const input of [BASE, { ...BASE, separationMicro: 10 }, { ...BASE, status: 'no-onset' as const }]) {
      expect(deriveConfidence(input).rationale.endsWith('Ranked suspicion is a prioritization aid, not proof of causality.')).toBe(true);
    }
  });
});

describe('rankSuspects honest outcomes', () => {
  it('labels error events without stack frames as weak evidence with zero trace values', () => {
    const outcome = rankSuspects(noStackInput());
    expect(outcome.status).toBe('ranked');
    expect(outcome.suspects[0]?.signals.find((signal) => signal.signal === 'trace-match')?.value).toBe(0);
    expect(outcome.confidence.labels).toContain('weak-evidence');
    expect(outcome.confidence.labels).toContain('low-confidence');
    expect(outcome.confidence.rationale).toContain('weak');
    expect(outcome.confidence.evidenceCompleteness).toBe(0);
  });

  it('returns no suspects when no onset window exists, for both non-incident classes', () => {
    const none = rankSuspects(noOnsetInput('none'));
    expect(none.status).toBe('no-onset');
    expect(none.referenceUtc).toBeNull();
    expect(none.eligibleCount).toBe(0);
    expect(none.suspects).toEqual([]);
    expect(none.considered.every((entry) => entry.status === 'excluded')).toBe(true);
    expect(none.confidence.band).toBe('low');
    expect(none.confidence.labels).toEqual(['low-confidence', 'no-clear-culprit']);
    expect(none.interpretation.startsWith('No statistically meaningful incident pattern')).toBe(true);

    const insufficient = rankSuspects(noOnsetInput('insufficient-data'));
    expect(insufficient.status).toBe('no-onset');
    expect(insufficient.interpretation.startsWith('Insufficient supplied data')).toBe(true);
  });

  it('returns no suspects when every commit is after the window start', () => {
    const outcome = rankSuspects(noEligibleInput());
    expect(outcome.status).toBe('no-eligible-commits');
    expect(outcome.referenceUtc).toBe(ONSET);
    expect(outcome.suspects).toEqual([]);
    expect(outcome.considered).toHaveLength(2);
    expect(outcome.considered.every((entry) => entry.status === 'excluded' && (entry.reason ?? '').includes('after'))).toBe(true);
    expect(outcome.confidence.band).toBe('low');
    expect(outcome.confidence.labels).toEqual(['low-confidence', 'no-clear-culprit']);
    expect(outcome.interpretation.startsWith('No supplied commit predates the onset window start')).toBe(true);
  });

  it('says the first commit ranks first with low confidence when separation is clear but no trace matches', () => {
    const outcome = rankSuspects(clearButUntracedInput());
    expect(outcome.status).toBe('ranked');
    expect(outcome.confidence.scoreSeparation ?? 0).toBeGreaterThanOrEqual(0.05);
    expect(outcome.confidence.labels).toEqual(['low-confidence', 'weak-evidence']);
    expect(outcome.interpretation.startsWith(`Commit ${hex('1').slice(0, 7)} ranks first, but confidence is low`)).toBe(true);
  });

  it('reports an ambiguous traced onset with tied scores as low confidence but not no-clear-culprit', () => {
    const outcome = rankSuspects(ambiguousOnsetInput());
    expect(outcome.confidence.labels).toEqual(['low-confidence', 'ambiguous']);
    expect(outcome.confidence.band).toBe('low');
    expect(outcome.interpretation.startsWith(`Commit ${hex('1').slice(0, 7)} ranks first, but confidence is low`)).toBe(true);
  });

  it('reports ambiguous plus untraced evidence as no clear culprit and a non-verdict', () => {
    const outcome = rankSuspects(ambiguousUntracedInput());
    expect(outcome.confidence.labels).toEqual(['low-confidence', 'ambiguous', 'weak-evidence', 'no-clear-culprit']);
    expect(outcome.interpretation.startsWith('No clear culprit is established:')).toBe(true);
    expect(outcome.interpretation.endsWith('Treat the shortlist as places to look, not a verdict.')).toBe(true);
    expect(outcome.interpretation).toContain('the onset pattern is ambiguous');
    expect(outcome.interpretation).toContain('no error trace identifies a changed line');
  });

  it('keeps a ramp onset medium and says so in the interpretation', () => {
    const outcome = rankSuspects(rampInput());
    expect(outcome.confidence.band).toBe('medium');
    expect(outcome.interpretation).toContain('gradual ramp');
    expect(outcome.interpretation).toContain('not proof of causality');
  });
});

describe('wording never presents a ranked guess as proof', () => {
  const BANNED = /caused by|the culprit is|\d\s*%|generated|Phase \d/i;

  const outcomes: [string, RankingOutcome][] = [
    ['single commit', singleCommitSpike()],
    ['five commits', rankSuspects(fiveCommitInput())],
    ['no stack', rankSuspects(noStackInput())],
    ['clear but untraced', rankSuspects(clearButUntracedInput())],
    ['no onset', rankSuspects(noOnsetInput('none'))],
    ['insufficient data', rankSuspects(noOnsetInput('insufficient-data'))],
    ['no eligible', rankSuspects(noEligibleInput())],
    ['ambiguous onset', rankSuspects(ambiguousOnsetInput())],
    ['ambiguous untraced', rankSuspects(ambiguousUntracedInput())],
    ['ramp', rankSuspects(rampInput())],
  ];

  it.each(outcomes)('keeps %s free of causal, percentage and roadmap wording', (_name, outcome) => {
    const strings = [
      outcome.interpretation,
      outcome.confidence.rationale,
      ...outcome.considered.map((entry) => entry.reason ?? ''),
      ...outcome.suspects.flatMap((suspect) => suspect.signals.map((signal) => signal.explanation)),
    ];
    for (const text of strings) expect(text).not.toMatch(BANNED);
  });

  it.each(outcomes.filter(([, outcome]) => outcome.status === 'ranked'))('qualifies the ranked interpretation for %s', (_name, outcome) => {
    expect(outcome.interpretation.includes('not proof of causality') || outcome.interpretation.includes('not a verdict')).toBe(true);
    expect(outcome.confidence.rationale).toContain('not proof of causality');
  });

  it('does not copy commit subject or author text into the interpretation', () => {
    const { events, errors } = exactLineErrors();
    const hostile = commit(hex('1'), '2026-10-19T04:20:00.000Z', [file(PAYMENT)]);
    const outcome = rankSuspects({
      commits: [{ ...hostile, subject: 'fix: caused by 100% the culprit is here', author: 'caused by me' }],
      events,
      errors,
      onset: onset('spike', ONSET),
    });
    expect(outcome.interpretation).not.toMatch(BANNED);
    expect(outcome.confidence.rationale).not.toMatch(BANNED);
  });
});
