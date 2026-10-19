import type {
  ChangedFile,
  ChangedLineRange,
  EvidenceReference,
  GitCommit,
  SignalContribution,
  SignalName,
  TimestampUtc,
  TraceMatchKind,
  TraceSummary,
} from './model';
import type { EvidenceIndex, IndexedFrame } from './evidence';
import { classifyLine, classifyPath, countAtOrAfter, lowerBound, matchPath } from './evidence';
import { compareText } from './normalization';

/**
 * Frozen scoring model, version `scoring-v1`. PRD section 4:
 * score = 0.35 * proximity + 0.30 * traceMatch + 0.25 * novelty + 0.10 * churn.
 * Any change to a constant here must bump `SCORING_VERSION` and regenerate every golden value.
 */
export const SCORING_V1 = Object.freeze({
  weights: Object.freeze<Record<SignalName, number>>({
    proximity: 0.35,
    'trace-match': 0.3,
    novelty: 0.25,
    churn: 0.1,
  }),
  proximityHalfLifeMinutes: 60,
  maxHalvings: 64,
  nearbyLines: 5,
  /** Trace strength 1.0 / 0.6 / 0.3 / 0 kept as integer tenths so sums stay exact. */
  traceStrengthTenths: Object.freeze<Record<TraceMatchKind, number>>({
    'exact-line': 10,
    'nearby-line': 6,
    'file-only': 3,
    none: 0,
  }),
  churn: Object.freeze({ halfSaturationLines: 50, lineShare: 0.7, fileShare: 0.3, fileCap: 5 }),
  topN: 3,
  thresholds: Object.freeze({
    ambiguousSeparationMicro: 50000,
    clearSeparationMicro: 150000,
    lineLevelShare: 0.5,
    stackCoverage: 0.75,
  }),
});

/** The fixed order in which signals are listed and summed. */
export const SIGNAL_ORDER: readonly SignalName[] = Object.freeze<SignalName[]>([
  'proximity',
  'trace-match',
  'novelty',
  'churn',
]);

/** Caps on evidence references per signal, so output size never grows with the input. */
export const EVIDENCE_LIMITS = Object.freeze({ logEvents: 3, groups: 5, files: 5 });

/** Round to 6 decimals using IEEE basic operations only; negative zero becomes zero. */
export function round6(value: number): number {
  const rounded = Math.round(value * 1e6) / 1e6;
  return rounded === 0 ? 0 : rounded;
}

/** Convert a score or value into integer micro-units for exact comparisons. */
export function toMicro(value: number): number {
  const micro = Math.round(value * 1e6);
  return micro === 0 ? 0 : micro;
}

/**
 * Piecewise-exponential decay with exact halving, avoiding engine-approximated math functions.
 * Knots: 12 min 0.9, 60 min 0.5, 120 min 0.25.
 */
export function proximityValue(gapMinutes: number): number {
  if (!(gapMinutes > 0)) return 1;
  const halfLives = gapMinutes / SCORING_V1.proximityHalfLifeMinutes;
  const whole = Math.min(Math.floor(halfLives), SCORING_V1.maxHalvings);
  let scale = 1;
  for (let step = 0; step < whole; step += 1) scale /= 2;
  return round6(scale * (1 - (halfLives - Math.floor(halfLives)) / 2));
}

/** Saturating churn: bounded below 1 so its 0.1 weight can never dominate. */
export function churnValue(linesChanged: number, filesTouched: number): number {
  const constants = SCORING_V1.churn;
  const lines = constants.lineShare * (linesChanged / (linesChanged + constants.halfSaturationLines));
  const files = constants.fileShare * Math.min(1, Math.max(0, filesTouched - 1) / (constants.fileCap - 1));
  return round6(lines + files);
}

export interface CommitScore {
  sha: string;
  timeGapMinutes: number;
  score: number;
  traceValue: number;
  signals: SignalContribution[];
  traceSummary: TraceSummary;
  evidenceReferences: EvidenceReference[];
}

interface SignalDraft {
  signal: SignalName;
  value: number;
  explanation: string;
  evidenceReferences: EvidenceReference[];
}

interface FrameMatch {
  frame: IndexedFrame;
  file: ChangedFile;
  kind: TraceMatchKind;
  range: ChangedLineRange | null;
  /** Error events with this top frame that happened at or after the commit. */
  count: number;
  startIndex: number;
}

const MATCH_RANK: Readonly<Record<TraceMatchKind, number>> = Object.freeze({
  none: 0,
  'file-only': 1,
  'nearby-line': 2,
  'exact-line': 3,
});

function frameLabel(path: string, line: number | null): string {
  return line === null ? path : `${path}:${line}`;
}

function rangeLabel(range: ChangedLineRange | null): string {
  return range === null ? '' : ` (changed lines ${range.start}-${range.end})`;
}

function referenceKey(reference: EvidenceReference): string {
  return JSON.stringify([
    reference.type,
    reference.sourceId,
    reference.path,
    reference.lineStart,
    reference.lineEnd,
    reference.detail,
  ]);
}

function dedupeReferences(references: readonly EvidenceReference[]): EvidenceReference[] {
  const seen = new Set<string>();
  const unique: EvidenceReference[] = [];
  for (const reference of references) {
    const key = referenceKey(reference);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(reference);
  }
  return unique;
}

function proximitySignal(commit: GitCommit, gap: number, referenceUtc: TimestampUtc): SignalDraft {
  const value = proximityValue(gap);
  const shownGap = String(round6(gap));
  const explanation = gap > 0
    ? `Committed ${shownGap} min before the onset window start ${referenceUtc}; closeness halves every `
      + `${SCORING_V1.proximityHalfLifeMinutes} min, giving ${String(value)}.`
    : `Committed at the onset window start ${referenceUtc}, so proximity is full (${String(value)}).`;
  return {
    signal: 'proximity',
    value,
    explanation,
    evidenceReferences: [{
      type: 'feature',
      sourceId: commit.sha,
      path: null,
      lineStart: null,
      lineEnd: null,
      detail: `${shownGap} min before onset window start ${referenceUtc}`,
    }],
  };
}

function traceSignal(commit: GitCommit, index: EvidenceIndex, commitEpoch: number): { draft: SignalDraft; summary: TraceSummary } {
  const total = index.totalErrorEvents;
  const changedPaths = commit.files.map((file) => file.path);
  const matches: FrameMatch[] = [];
  const refused: { frame: IndexedFrame; candidateCount: number }[] = [];
  let sumTenths = 0;

  for (const frame of index.frames) {
    const startIndex = lowerBound(frame.epochs, commitEpoch);
    const count = frame.epochs.length - startIndex;
    if (count === 0) continue;
    const pathMatch = matchPath(frame.path, changedPaths);
    if (pathMatch.kind === 'none') continue;
    if (pathMatch.kind === 'ambiguous') {
      refused.push({ frame, candidateCount: pathMatch.paths.length });
      continue;
    }
    const file = commit.files.find((candidate) => candidate.path === pathMatch.path);
    if (file === undefined) continue;
    const line = classifyLine(frame.line, file.ranges, SCORING_V1.nearbyLines);
    sumTenths += SCORING_V1.traceStrengthTenths[line.kind] * count;
    matches.push({ frame, file, kind: line.kind, range: line.range, count, startIndex });
  }

  const value = total === 0 ? 0 : round6(sumTenths / (10 * total));
  const strongest = [...matches].sort((left, right) =>
    MATCH_RANK[right.kind] - MATCH_RANK[left.kind] || right.count - left.count).at(0);
  const matchedErrorCount = matches.reduce((sum, match) => sum + match.count, 0);
  const lineLevelErrorCount = matches
    .filter((match) => match.kind === 'exact-line' || match.kind === 'nearby-line')
    .reduce((sum, match) => sum + match.count, 0);
  const summary: TraceSummary = {
    matchKind: strongest === undefined ? 'none' : strongest.kind,
    matchedErrorCount,
    lineLevelErrorCount,
    totalErrorCount: total,
  };

  const references: EvidenceReference[] = [];
  const byImpact = [...matches].sort((left, right) => right.count - left.count);
  for (const match of byImpact.slice(0, EVIDENCE_LIMITS.files)) {
    references.push({
      type: 'file-range',
      sourceId: commit.sha,
      path: match.file.path,
      lineStart: match.range === null ? null : match.range.start,
      lineEnd: match.range === null ? null : match.range.end,
      detail: `${match.kind} match for frame ${frameLabel(match.frame.path, match.frame.line)}; `
        + `${match.count} of ${total} error events`,
    });
  }

  for (const entry of refused.slice(0, EVIDENCE_LIMITS.files)) {
    references.push({
      type: 'feature',
      sourceId: commit.sha,
      path: null,
      lineStart: null,
      lineEnd: null,
      detail: `frame ${frameLabel(entry.frame.path, entry.frame.line)} matched ${entry.candidateCount} changed files `
        + 'by path suffix; no trace credit was given',
    });
  }

  const groupMatches = new Map<string, number>();
  for (const match of matches) {
    for (const entry of match.frame.signatures) {
      const matched = countAtOrAfter(entry.epochs, commitEpoch);
      if (matched > 0) groupMatches.set(entry.signature, (groupMatches.get(entry.signature) ?? 0) + matched);
    }
  }
  const groupCounts = new Map(index.groups.map((group) => [group.signature, group.count] as const));
  const orderedGroups = [...groupMatches.entries()]
    .sort(([leftSignature, leftCount], [rightSignature, rightCount]) =>
      rightCount - leftCount || compareText(leftSignature, rightSignature))
    .slice(0, EVIDENCE_LIMITS.groups);
  for (const [signature, matched] of orderedGroups) {
    references.push({
      type: 'error-group',
      sourceId: signature,
      path: null,
      lineStart: null,
      lineEnd: null,
      detail: `${matched} of ${groupCounts.get(signature) ?? matched} events match`,
    });
  }

  const earliest = matches.flatMap((match) =>
    match.frame.events.slice(match.startIndex, match.startIndex + EVIDENCE_LIMITS.logEvents)
      .map((event) => ({ event, frame: match.frame })))
    .sort((left, right) => left.event.epoch - right.event.epoch || compareText(left.event.eventId, right.event.eventId))
    .slice(0, EVIDENCE_LIMITS.logEvents);
  for (const { event, frame } of earliest) {
    references.push({
      type: 'log-event',
      sourceId: event.eventId,
      path: frame.path,
      lineStart: frame.line,
      lineEnd: frame.line,
      detail: `error event at ${event.timestampUtc} with top application frame ${frameLabel(frame.path, frame.line)}`,
    });
  }

  const refusedNote = refused.length === 0
    ? ''
    : ` ${refused.length} frame path(s) matched several changed files by suffix and received no credit.`;
  let explanation: string;
  if (strongest !== undefined && value > 0) {
    explanation = `${matchedErrorCount} of ${total} error events at or after this commit have a top application frame in a `
      + `file it changed; the strongest match is ${strongest.kind} at ${frameLabel(strongest.frame.path, strongest.frame.line)}`
      + `${rangeLabel(strongest.range)}, giving ${String(value)}.${refusedNote}`;
  } else if (total === 0) {
    explanation = 'No error events were found, so there is no trace evidence to match.';
  } else if (index.applicationFrameEvents === 0) {
    explanation = 'No error event has an application-owned stack frame, so trace evidence is unavailable.';
  } else if (commit.files.length === 0) {
    explanation = 'This commit lists no changed files, so no stack frame can match it.';
  } else {
    explanation = 'No error event at or after this commit has a top application frame in a file it changed, '
      + `so trace match is 0.${refusedNote}`;
  }

  return { draft: { signal: 'trace-match', value, explanation, evidenceReferences: references }, summary };
}

function noveltySignal(index: EvidenceIndex, commitEpoch: number): SignalDraft {
  const total = index.totalErrorEvents;
  const fresh = index.groups.filter((group) => group.firstSeenEpoch >= commitEpoch);
  const freshEvents = fresh.reduce((sum, group) => sum + group.count, 0);
  const value = total === 0 ? 0 : round6(freshEvents / total);
  let explanation: string;
  if (total === 0) explanation = 'No error events were found, so novelty cannot be measured.';
  else if (freshEvents === 0) explanation = 'Every error signature was already present before this commit, so novelty is 0.';
  else {
    explanation = `${freshEvents} of ${total} error events belong to signatures first seen at or after this commit, `
      + `giving ${String(value)}.`;
  }
  const references: EvidenceReference[] = [...fresh]
    .sort((left, right) => left.firstSeenEpoch - right.firstSeenEpoch || compareText(left.signature, right.signature))
    .slice(0, EVIDENCE_LIMITS.groups)
    .map((group) => ({
      type: 'error-group' as const,
      sourceId: group.signature,
      path: null,
      lineStart: null,
      lineEnd: null,
      detail: `first seen ${group.firstSeenUtc} (${group.count} events), at or after this commit`,
    }));
  return { signal: 'novelty', value, explanation, evidenceReferences: references };
}

function churnSignal(commit: GitCommit): SignalDraft {
  // Build-output files (bundles, maps, type stubs) inflate line counts without being authored code.
  const owned = commit.files.filter((file) => classifyPath(file.path) !== 'build-output');
  const ignored = commit.files.length - owned.length;
  const lines = owned.reduce((sum, file) => sum + file.added + file.deleted, 0);
  const files = owned.length;
  const value = churnValue(lines, files);
  const ignoredNote = ignored === 0 ? '' : ` ${ignored} build-output file${ignored === 1 ? ' was' : 's were'} ignored.`;
  let explanation: string;
  if (commit.files.length === 0) explanation = 'This commit lists no changed files, so churn is 0.';
  else if (files === 0) explanation = `Only build-output files changed, so churn is 0.${ignoredNote}`;
  else {
    explanation = `Changed ${lines} lines across ${files} ${files === 1 ? 'file' : 'files'}; churn is bounded to `
      + `contribute at most 0.1 of the score, giving ${String(value)}.${ignoredNote}`;
  }
  const references: EvidenceReference[] = [...owned]
    .sort((left, right) => compareText(left.path, right.path))
    .slice(0, EVIDENCE_LIMITS.files)
    .map((file) => ({
      type: 'file-range' as const,
      sourceId: commit.sha,
      path: file.path,
      lineStart: file.ranges.length === 0 ? null : Math.min(...file.ranges.map((range) => range.start)),
      lineEnd: file.ranges.length === 0 ? null : Math.max(...file.ranges.map((range) => range.end)),
      detail: `+${file.added}/-${file.deleted} lines`,
    }));
  return { signal: 'churn', value, explanation, evidenceReferences: references };
}

/**
 * Score one commit with the four frozen signals against the analysis evidence. `referenceUtc` is the
 * onset window start; a commit at or after it has a zero gap.
 */
export function scoreCommit(commit: GitCommit, index: EvidenceIndex, referenceUtc: TimestampUtc): CommitScore {
  const referenceEpoch = Date.parse(referenceUtc);
  if (!Number.isFinite(referenceEpoch)) throw new Error('referenceUtc must be a valid UTC timestamp.');
  const commitEpoch = Date.parse(commit.timestampUtc);
  const gap = Math.max(0, (referenceEpoch - commitEpoch) / 60000);

  const trace = traceSignal(commit, index, commitEpoch);
  const drafts: Record<SignalName, SignalDraft> = {
    proximity: proximitySignal(commit, gap, referenceUtc),
    'trace-match': trace.draft,
    novelty: noveltySignal(index, commitEpoch),
    churn: churnSignal(commit),
  };

  const signals: SignalContribution[] = SIGNAL_ORDER.map((name) => {
    const draft = drafts[name];
    const weight = SCORING_V1.weights[name];
    return {
      signal: name,
      value: draft.value,
      weight,
      contribution: round6(draft.value * weight),
      explanation: draft.explanation,
      evidenceReferences: draft.evidenceReferences,
    };
  });

  let sum = 0;
  for (const signal of signals) sum += signal.contribution;

  return {
    sha: commit.sha,
    timeGapMinutes: round6(gap),
    score: round6(sum),
    traceValue: trace.draft.value,
    signals,
    traceSummary: trace.summary,
    evidenceReferences: dedupeReferences(signals.flatMap((signal) => signal.evidenceReferences)),
  };
}
