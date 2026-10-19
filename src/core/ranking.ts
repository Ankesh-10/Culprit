import type {
  CommitDisposition,
  ConfidenceLabel,
  ConfidenceRationale,
  ErrorGroup,
  GitCommit,
  LogEvent,
  OnsetAnalysis,
  OnsetClass,
  RankingOutcome,
  RankingStatus,
  ScoredSuspect,
  TimestampUtc,
} from './model';
import { CONFIDENCE_LABEL_ORDER } from './model';
import { buildEvidenceIndex } from './evidence';
import { compareText } from './normalization';
import { SCORING_V1, round6, scoreCommit, toMicro } from './scoring';
import type { CommitScore } from './scoring';

export interface RankingInput {
  commits: readonly GitCommit[];
  events: readonly LogEvent[];
  errors: readonly ErrorGroup[];
  onset: Pick<OnsetAnalysis, 'class' | 'windowStartUtc'>;
}

/** Integer sort key for one scored commit. Raw floating-point scores are never compared. */
export interface RankedKey {
  scoreMicro: number;
  traceMicro: number;
  committedEpoch: number;
  sha: string;
}

/**
 * Total order: score descending, trace match descending, commit time descending (later first),
 * SHA ascending by code unit. All numeric comparisons are on integers.
 */
export function compareRanked(left: RankedKey, right: RankedKey): number {
  return (right.scoreMicro - left.scoreMicro)
    || (right.traceMicro - left.traceMicro)
    || (right.committedEpoch - left.committedEpoch)
    || compareText(left.sha, right.sha);
}

export interface ConfidenceInput {
  status: RankingStatus;
  onsetClass: OnsetClass;
  separationMicro: number | null;
  lineLevelErrorCount: number;
  applicationFrameEvents: number;
  totalErrorEvents: number;
}

const CLOSING = 'Ranked suspicion is a prioritization aid, not proof of causality.';

function micro(value: number): string {
  return String(round6(value / 1e6));
}

function isTightSeparation(separationMicro: number | null): boolean {
  return separationMicro !== null && separationMicro < SCORING_V1.thresholds.ambiguousSeparationMicro;
}

/** Fewer than half (`lineLevelShare` 0.5) of error events match a changed line, in integer form. */
function isWeakEvidence(input: ConfidenceInput): boolean {
  return input.applicationFrameEvents === 0
    || input.totalErrorEvents === 0
    || input.lineLevelErrorCount * 2 < input.totalErrorEvents;
}

/** Application-frame coverage below `stackCoverage` 0.75, in integer form. */
function isLowCoverage(input: ConfidenceInput): boolean {
  return input.applicationFrameEvents * 4 < input.totalErrorEvents * 3;
}

function weakClause(input: ConfidenceInput): string {
  if (input.applicationFrameEvents === 0 || input.totalErrorEvents === 0) {
    return 'no application stack frame exists to match against changed lines';
  }
  return `fewer than half of error events (${input.lineLevelErrorCount} of ${input.totalErrorEvents}) match a changed line of the leading suspect`;
}

function ambiguousClauses(input: ConfidenceInput): string[] {
  const clauses: string[] = [];
  if (isTightSeparation(input.separationMicro) && input.separationMicro !== null) {
    clauses.push(`the top two scores are separated by only ${micro(input.separationMicro)}`);
  }
  if (input.onsetClass === 'ambiguous') clauses.push('the onset pattern is ambiguous');
  return clauses;
}

/** Derive the confidence band, explicit labels and plain-language rationale from integer evidence. */
export function deriveConfidence(input: ConfidenceInput): ConfidenceRationale {
  const ranked = input.status === 'ranked';
  const ambiguous = ranked && (isTightSeparation(input.separationMicro) || input.onsetClass === 'ambiguous');
  const weak = ranked && isWeakEvidence(input);
  const noClearCulprit = !ranked || (ambiguous && weak);
  const low = !ranked || ambiguous || weak;
  const capped = input.onsetClass === 'ramp'
    || input.separationMicro === null
    || input.separationMicro < SCORING_V1.thresholds.clearSeparationMicro
    || isLowCoverage(input);
  const band = low ? 'low' : capped ? 'medium' : 'high';

  const applied: Record<ConfidenceLabel, boolean> = {
    'low-confidence': band === 'low',
    ambiguous,
    'weak-evidence': weak,
    'no-clear-culprit': noClearCulprit,
  };
  const labels = CONFIDENCE_LABEL_ORDER.filter((label) => applied[label]);

  const sentences: string[] = [];
  if (!ranked) {
    sentences.push(input.status === 'no-onset'
      ? 'No ranking was produced because no incident onset window was established.'
      : 'No ranking was produced because no supplied commit predates the onset window start.');
  } else if (band === 'high') {
    sentences.push(
      `The leading commit is separated from the runner-up by ${micro(input.separationMicro ?? 0)}, and `
      + `${input.lineLevelErrorCount} of ${input.totalErrorEvents} error events match changed lines.`,
    );
  } else if (band === 'medium') {
    if (input.onsetClass === 'ramp') sentences.push('The onset is a gradual ramp, which weakens exact timing.');
    if (input.separationMicro === null) {
      sentences.push('Only one eligible commit exists, so no runner-up is available for comparison.');
    } else if (input.separationMicro < SCORING_V1.thresholds.clearSeparationMicro) {
      sentences.push(`The gap between the top two scores is moderate (${micro(input.separationMicro)}).`);
    }
    if (isLowCoverage(input)) {
      sentences.push(`Only ${input.applicationFrameEvents} of ${input.totalErrorEvents} error events carry an application stack frame.`);
    }
  } else {
    if (ambiguous) sentences.push(`The ranking is ambiguous because ${ambiguousClauses(input).join(' and ')}.`);
    if (weak) sentences.push(`Evidence is weak: ${weakClause(input)}.`);
    if (noClearCulprit) sentences.push('No clear culprit is established.');
  }
  sentences.push(CLOSING);

  return {
    band,
    labels,
    rationale: sentences.join(' '),
    scoreSeparation: input.separationMicro === null ? null : round6(input.separationMicro / 1e6),
    evidenceCompleteness: input.totalErrorEvents === 0 ? 0 : round6(input.applicationFrameEvents / input.totalErrorEvents),
  };
}

interface Candidate {
  commit: GitCommit;
  epoch: number;
}

function sortedCandidates(commits: readonly GitCommit[]): Candidate[] {
  return commits
    .map((commit) => {
      const parsed = Date.parse(commit.timestampUtc);
      return { commit, epoch: Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER };
    })
    .sort((left, right) => left.epoch - right.epoch || compareText(left.commit.sha, right.commit.sha));
}

function disposition(commit: GitCommit, status: CommitDisposition['status'], rank: number | null, score: number | null, reason: string | null): CommitDisposition {
  return {
    sha: commit.sha,
    shortSha: commit.sha.slice(0, 7),
    subject: commit.subject,
    author: commit.author,
    committedAtUtc: commit.timestampUtc,
    status,
    rank,
    score,
    reason,
  };
}

function interpretNoRanking(status: RankingStatus, onsetClass: OnsetClass, referenceUtc: TimestampUtc | null): string {
  if (status === 'no-eligible-commits') {
    return `No supplied commit predates the onset window start (${referenceUtc ?? 'unknown'}), so no commits were ranked.`;
  }
  return onsetClass === 'insufficient-data'
    ? 'Insufficient supplied data to infer an incident onset, so no commits were ranked.'
    : 'No statistically meaningful incident pattern was detected in the supplied snapshot, so no commits were ranked.';
}

function interpretRanked(input: ConfidenceInput, confidence: ConfidenceRationale, leaderShortSha: string, eligibleCount: number): string {
  const reasons: string[] = [...ambiguousClauses(input)];
  if (confidence.labels.includes('weak-evidence')) {
    reasons.push(input.applicationFrameEvents === 0 || input.totalErrorEvents === 0
      ? 'no application stack frame exists to match'
      : input.lineLevelErrorCount === 0
        ? 'no error trace identifies a changed line'
        : 'fewer than half of the error traces identify a changed line');
  }
  if (confidence.labels.includes('no-clear-culprit')) {
    return `No clear culprit is established: ${reasons.join('; ')}. Treat the shortlist as places to look, not a verdict.`;
  }
  if (confidence.band === 'low') {
    return `Commit ${leaderShortSha} ranks first, but confidence is low: ${reasons.join('; ')}. This is ranked suspicion, not proof of causality.`;
  }
  const ramp = input.onsetClass === 'ramp'
    ? '; the gradual ramp weakens any claim of an exact causal moment'
    : '';
  return `Commit ${leaderShortSha} is the leading investigation target among ${eligibleCount} pre-onset commit(s)${ramp}. This is ranked suspicion, not proof of causality.`;
}

/**
 * Rank pre-onset commits into a deterministic top-three shortlist. A commit is eligible when it was
 * committed at or before the onset window start (inclusive). Pure and total: it never throws on
 * odd input and reads no clock, randomness or locale.
 */
export function rankSuspects(input: RankingInput): RankingOutcome {
  const candidates = sortedCandidates(input.commits);
  const index = buildEvidenceIndex(input.events, input.errors);
  const referenceUtc = input.onset.windowStartUtc;
  const referenceEpoch = referenceUtc === null ? Number.NaN : Date.parse(referenceUtc);

  const finish = (
    status: RankingStatus,
    considered: CommitDisposition[],
    suspects: ScoredSuspect[],
    eligibleCount: number,
    separationMicro: number | null,
    lineLevelErrorCount: number,
    reference: TimestampUtc | null,
  ): RankingOutcome => {
    const confidenceInput: ConfidenceInput = {
      status,
      onsetClass: input.onset.class,
      separationMicro,
      lineLevelErrorCount,
      applicationFrameEvents: index.applicationFrameEvents,
      totalErrorEvents: index.totalErrorEvents,
    };
    const confidence = deriveConfidence(confidenceInput);
    const leader = suspects[0];
    const interpretation = status !== 'ranked' || leader === undefined
      ? interpretNoRanking(status, input.onset.class, reference)
      : interpretRanked(confidenceInput, confidence, leader.shortSha, eligibleCount);
    return { status, referenceUtc: reference, eligibleCount, considered, suspects, confidence, interpretation };
  };

  if (referenceUtc === null || !Number.isFinite(referenceEpoch)) {
    const reason = 'No onset window was established, so no commit was ranked.';
    return finish(
      'no-onset',
      candidates.map(({ commit }) => disposition(commit, 'excluded', null, null, reason)),
      [],
      0,
      null,
      0,
      null,
    );
  }

  const eligible = candidates.filter((candidate) => candidate.epoch <= referenceEpoch);
  if (eligible.length === 0) {
    const reason = `Committed after the onset window start (${referenceUtc}); not eligible.`;
    return finish(
      'no-eligible-commits',
      candidates.map(({ commit }) => disposition(commit, 'excluded', null, null, reason)),
      [],
      0,
      null,
      0,
      referenceUtc,
    );
  }

  const scored = eligible
    .map((candidate) => {
      const result: CommitScore = scoreCommit(candidate.commit, index, referenceUtc);
      const key: RankedKey = {
        scoreMicro: toMicro(result.score),
        traceMicro: toMicro(result.traceValue),
        committedEpoch: candidate.epoch,
        sha: candidate.commit.sha,
      };
      return { candidate, result, key };
    })
    .sort((left, right) => compareRanked(left.key, right.key));

  const rankBySha = new Map<string, number>();
  scored.forEach((entry, position) => rankBySha.set(entry.candidate.commit.sha, position + 1));

  const suspects: ScoredSuspect[] = scored.slice(0, SCORING_V1.topN).map(({ candidate, result }, position) => ({
    rank: position + 1,
    sha: candidate.commit.sha,
    shortSha: candidate.commit.sha.slice(0, 7),
    subject: candidate.commit.subject,
    author: candidate.commit.author,
    committedAtUtc: candidate.commit.timestampUtc,
    score: result.score,
    timeGapMinutes: result.timeGapMinutes,
    traceSummary: { ...result.traceSummary },
    signals: result.signals.map((signal) => ({
      ...signal,
      evidenceReferences: signal.evidenceReferences.map((reference) => ({ ...reference })),
    })),
    evidenceReferences: result.evidenceReferences.map((reference) => ({ ...reference })),
    tieBreakKey: [String(result.score), String(result.traceValue), candidate.commit.timestampUtc, candidate.commit.sha].join('|'),
  }));

  const scoreBySha = new Map(scored.map((entry) => [entry.candidate.commit.sha, entry.result.score] as const));
  const considered = candidates.map(({ commit, epoch }): CommitDisposition => {
    const rank = rankBySha.get(commit.sha);
    if (epoch > referenceEpoch || rank === undefined) {
      return disposition(commit, 'excluded', null, null, `Committed after the onset window start (${referenceUtc}); not eligible.`);
    }
    return disposition(commit, rank <= SCORING_V1.topN ? 'top-three' : 'scored', rank, scoreBySha.get(commit.sha) ?? null, null);
  });

  const first = scored[0];
  const second = scored[1];
  const separationMicro = first !== undefined && second !== undefined ? first.key.scoreMicro - second.key.scoreMicro : null;
  return finish(
    'ranked',
    considered,
    suspects,
    eligible.length,
    separationMicro,
    first?.result.traceSummary.lineLevelErrorCount ?? 0,
    referenceUtc,
  );
}
