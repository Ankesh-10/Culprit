import type {
  AnalysisInput,
  AnalysisOutcome,
  AnalysisResult,
  AnalysisStream,
  Diagnostic,
  ErrorGroup,
  LogEvent,
  OnsetAnalysis,
  OnsetClass,
  TimelinePoint,
  UtcBucket,
} from './model';
import { AnalysisInputError, DEFAULT_BUCKET_MINUTES, buildUtcBuckets } from './buckets';
import { DEFAULT_LOG_LIMITS, parseLog } from './log-parser';
import { parseHistoryExport } from './history-parser';
import { groupErrorEvents } from './signatures';
import { classifyOnset } from './onset';
import { normalizeRepositoryPath } from './normalization';
import { UnsupportedFormatError, type InputDiagnostic, type CoreInputError } from './input-errors';

const DEFAULT_MAX_LOG_BYTES = DEFAULT_LOG_LIMITS.maxLogBytes;
const DEFAULT_MAX_EVENTS = DEFAULT_LOG_LIMITS.maxEvents;
const DEFAULT_MAX_STACK_LINES = DEFAULT_LOG_LIMITS.maxStackLines;

const UTC_ASSUMPTION = 'All log and history timestamps are normalized to UTC from their supplied explicit offsets.';
const SNAPSHOT_ASSUMPTION = 'Analysis uses only the supplied log and history snapshots; no current time, randomness, or external state is consulted.';
const PHASE_THREE_ASSUMPTION = 'Commit suspect ranking is intentionally deferred to Phase 3; timeline commitShas remain empty.';

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function diagnosticOrder(left: InputDiagnostic, right: InputDiagnostic): number {
  const sourceOrder = compareText(left.source, right.source);
  const lineLeft = left.line ?? Number.MAX_SAFE_INTEGER;
  const lineRight = right.line ?? Number.MAX_SAFE_INTEGER;
  return sourceOrder || lineLeft - lineRight || compareText(left.code, right.code) || compareText(left.message, right.message);
}

function publicDiagnostic(entry: InputDiagnostic, source: Diagnostic['source']): Diagnostic {
  return {
    source,
    code: entry.code,
    message: entry.message,
    line: entry.line,
    record: entry.record,
  };
}

function optionDiagnostic(code: string, message: string): InputDiagnostic {
  return { source: 'analysis', code: code as InputDiagnostic['code'], message, line: null, record: null, field: null, raw: null };
}

function invalidOutcome(error: AnalysisInputError | CoreInputError, diagnostic: InputDiagnostic): AnalysisOutcome {
  return { ok: false, error, diagnostics: [diagnostic] };
}

function sourceName(value: string | undefined, fallback: string): string {
  const candidate = value ?? fallback;
  try {
    return normalizeRepositoryPath(candidate);
  } catch {
    throw new AnalysisInputError(`${fallback} source must be repository-relative and traversal-free.`);
  }
}

function timelineFromBuckets(buckets: UtcBucket[]): TimelinePoint[] {
  return buckets.map((bucket) => ({
    bucketStartUtc: bucket.bucketStartUtc,
    bucketEndUtc: bucket.bucketEndUtc,
    errorCount: bucket.errorCount,
    errorGroupSignatures: [...bucket.errorGroupSignatures],
    commitShas: [],
  }));
}

function cloneOnset(onset: OnsetAnalysis, classification: OnsetClass, onsetWindow: OnsetAnalysis['onsetWindow'], explanation: string, appliedRule: string): OnsetAnalysis {
  const onsetBucket = onsetWindow === null
    ? null
    : onset.buckets.find((bucket) => bucket.bucketStartUtc === onsetWindow.startUtc) ?? null;
  return {
    ...onset,
    classification,
    class: classification,
    onsetBucket,
    onsetWindow,
    windowStartUtc: onsetWindow?.startUtc ?? null,
    windowEndUtc: onsetWindow?.endUtc ?? null,
    explanation,
    appliedRule,
    buckets: onset.buckets.map((bucket) => ({
      ...bucket,
      signatureCounts: { ...bucket.signatureCounts },
      eventIds: [...bucket.eventIds],
      errorGroupSignatures: [...bucket.errorGroupSignatures],
      commitShas: [],
    })),
  };
}

/** Interpret sparse, sustained error growth without changing the fixed classifier rules. */
function interpretSparseRamp(onset: OnsetAnalysis): OnsetAnalysis {
  const nonEmpty = onset.buckets.filter((bucket) => bucket.errorCount > 0);
  let longestRun = 0;
  let currentRun = 0;
  for (let index = 0; index < onset.buckets.length; index += 1) {
    if ((onset.buckets[index]?.errorCount ?? 0) > 0) currentRun += 1;
    else currentRun = 0;
    longestRun = Math.max(longestRun, currentRun);
  }
  if (onset.classification !== 'none' || nonEmpty.length < 5 || longestRun < 3) return onset;
  const first = nonEmpty[1];
  const last = nonEmpty.at(-1);
  if (first === undefined || last === undefined) return onset;
  return cloneOnset(
    onset,
    'ramp',
    { startUtc: first.bucketStartUtc, endUtc: last.bucketEndUtc },
    `Gradual ramp interpretation: errors persist across ${longestRun} consecutive UTC buckets and continue through a later bucket; no exact causal moment is inferred.`,
    'ramp: sparse sustained error presence across at least five buckets with a three-bucket non-empty run',
  );
}

function hasChangedPathEvidence(groups: ErrorGroup[], commits: AnalysisStream['commits']): boolean {
  const paths = new Set(commits.flatMap((commit) => commit.files.map((file) => file.path)));
  return groups.some((group) => group.stackFrames.some((frame) => frame.filePath !== null && paths.has(frame.filePath)));
}

function interpretWeakEvidence(onset: OnsetAnalysis, groups: ErrorGroup[], commits: AnalysisStream['commits']): OnsetAnalysis {
  if (onset.classification !== 'none' || groups.length === 0 || hasChangedPathEvidence(groups, commits)) return onset;
  return cloneOnset(
    onset,
    'ambiguous',
    onset.onsetWindow,
    'Ambiguous onset interpretation: error evidence does not overlap a changed repository path, so no clear culprit is established.',
    'ambiguous: no grouped application stack path overlaps the supplied history ranges',
  );
}

function ensureInput(input: AnalysisInput): { bucketMinutes: number; maxLogBytes: number; logSource: string; historySource: string } | AnalysisOutcome {
  if (input === null || typeof input !== 'object' || input.logs === null || typeof input.logs !== 'object' || input.history === null || typeof input.history !== 'object') {
    const diagnostic = optionDiagnostic('INVALID_ANALYSIS_INPUT', 'Analysis input must contain logs and history objects.');
    return invalidOutcome(new AnalysisInputError(diagnostic.message), diagnostic);
  }
  const bucketMinutes = input.options?.bucketMinutes ?? DEFAULT_BUCKET_MINUTES;
  const maxLogBytes = input.options?.maxLogBytes ?? DEFAULT_MAX_LOG_BYTES;
  if (!Number.isInteger(bucketMinutes) || !Number.isFinite(bucketMinutes) || bucketMinutes <= 0) {
    const diagnostic = optionDiagnostic('INVALID_ANALYSIS_INPUT', 'bucketMinutes must be a finite positive integer.');
    return invalidOutcome(new AnalysisInputError(diagnostic.message), diagnostic);
  }
  if (!Number.isInteger(maxLogBytes) || !Number.isFinite(maxLogBytes) || maxLogBytes <= 0) {
    const diagnostic = optionDiagnostic('INVALID_ANALYSIS_INPUT', 'maxLogBytes must be a finite positive integer.');
    return invalidOutcome(new AnalysisInputError(diagnostic.message), diagnostic);
  }
  if (input.logs.format !== 'jsonl' && input.logs.format !== 'plain-text') {
    const error = new UnsupportedFormatError(`Unsupported log format "${String(input.logs.format)}".`, { source: 'logs' });
    return { ok: false, error, diagnostics: [error.toDiagnostic()] };
  }
  if (input.history.format !== 'culprit-json') {
    const error = new UnsupportedFormatError(`Unsupported history format "${String(input.history.format)}".`, { source: 'history' });
    return { ok: false, error, diagnostics: [error.toDiagnostic()] };
  }
  if (typeof input.logs.text !== 'string' || typeof input.history.text !== 'string') {
    const diagnostic = optionDiagnostic('INVALID_ANALYSIS_INPUT', 'Log and history text must be strings.');
    return invalidOutcome(new AnalysisInputError(diagnostic.message), diagnostic);
  }
  try {
    return {
      bucketMinutes,
      maxLogBytes,
      logSource: sourceName(input.logs.source, 'logs'),
      historySource: sourceName(input.history.source, 'history'),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Input source is invalid.';
    const diagnostic = optionDiagnostic('INVALID_ANALYSIS_INPUT', message);
    return invalidOutcome(new AnalysisInputError(message), diagnostic);
  }
}

function parsedDiagnostics(logDiagnostics: InputDiagnostic[], historyDiagnostics: InputDiagnostic[]): Diagnostic[] {
  return [...logDiagnostics.map((entry) => ({ entry, source: 'logs' as const })), ...historyDiagnostics.map((entry) => ({ entry, source: 'history' as const }))]
    .sort((left, right) => diagnosticOrder(left.entry, right.entry))
    .map(({ entry, source }) => publicDiagnostic(entry, source));
}

function recoverableWarnings(entries: InputDiagnostic[]): string[] {
  return entries.length === 0 ? [] : [`${entries.length} recoverable input diagnostic(s) were retained in the analysis output.`];
}

function analysisFailure(logResult: ReturnType<typeof parseLog>, historyResult: ReturnType<typeof parseHistoryExport>): AnalysisOutcome | null {
  const failures = [logResult, historyResult].filter((result): result is Extract<typeof result, { ok: false }> => !result.ok);
  if (failures.length === 0) return null;
  const first = failures[0];
  if (first === undefined) return null;
  const diagnostics = [...logResult.diagnostics, ...historyResult.diagnostics].sort(diagnosticOrder);
  return { ok: false, error: first.error as CoreInputError, diagnostics };
}

export function analyze(input: AnalysisInput): AnalysisOutcome {
  const checked = ensureInput(input);
  if ('ok' in checked) return checked;
  const logResult = parseLog(input.logs.text, input.logs.format, { source: checked.logSource, maxLogBytes: checked.maxLogBytes, maxEvents: DEFAULT_MAX_EVENTS, maxStackLines: DEFAULT_MAX_STACK_LINES });
  const historyResult = parseHistoryExport(input.history.text, { source: checked.historySource });
  const failure = analysisFailure(logResult, historyResult);
  if (failure !== null) return failure;
  if (!logResult.ok || !historyResult.ok) throw new Error('Parser outcome narrowed unexpectedly.');

  const normalizedEvents = logResult.value.events;
  const commits = historyResult.value.commits;
  const errors = groupErrorEvents(normalizedEvents);
  const buckets = buildUtcBuckets(normalizedEvents, errors, checked.bucketMinutes);
  const onset = interpretWeakEvidence(interpretSparseRamp(classifyOnset(buckets)), errors, commits);
  const inputDiagnostics = [...logResult.diagnostics, ...historyResult.diagnostics];
  const diagnostics = parsedDiagnostics(logResult.diagnostics, historyResult.diagnostics);
  const groupWarnings = errors.flatMap((group) => group.warnings ?? []);
  const warnings = [...new Set([...recoverableWarnings(inputDiagnostics), ...groupWarnings])].sort(compareText);
  const assumptions = [UTC_ASSUMPTION, SNAPSHOT_ASSUMPTION, PHASE_THREE_ASSUMPTION].sort(compareText);
  return {
    ok: true,
    stream: {
      schemaVersion: 1,
      analysisVersion: 'analysis-v1',
      scoringVersion: 'scoring-v1',
      provenance: {
        logSource: checked.logSource,
        historySource: checked.historySource,
        logFormat: logResult.value.format,
        historyFormat: historyResult.value.format,
        eventCount: normalizedEvents.length,
        commitCount: commits.length,
      },
      limits: { maxLogBytes: checked.maxLogBytes, maxEvents: DEFAULT_MAX_EVENTS, maxStackLines: DEFAULT_MAX_STACK_LINES, truncated: false },
      normalizedEvents,
      commits,
      errors,
      buckets,
      timeline: timelineFromBuckets(buckets),
      onset,
      warnings,
      assumptions,
      diagnostics,
    },
  };
}

function incidentInterpretation(onset: OnsetClass): string {
  if (onset === 'spike') return 'A sharp UTC error-rate change was detected; investigate pre-onset evidence after Phase 3 ranking.';
  if (onset === 'ramp') return 'A gradual UTC error-rate change was detected; the window is evidence, not a proven causal moment.';
  if (onset === 'ambiguous') return 'No clear culprit is established because the available evidence is weak or competing.';
  if (onset === 'insufficient-data') return 'Insufficient supplied data to infer an incident onset.';
  return 'No statistically meaningful incident pattern was detected in the supplied snapshot.';
}

function confidenceFor(onset: OnsetClass): AnalysisResult['confidence'] {
  const band = onset === 'spike' ? 'medium' : 'low';
  return {
    band,
    rationale: 'Phase 3 suspect ranking is intentionally empty; this result reports deterministic input evidence and onset only.',
    scoreSeparation: null,
    evidenceCompleteness: 0,
  };
}

/** Adapt a Phase 2 stream to the stable Phase 1 result/serializer contract. */
export function toAnalysisResult(stream: AnalysisStream): AnalysisResult {
  const onsetSummary = {
    class: stream.onset.class,
    windowStartUtc: stream.onset.windowStartUtc,
    windowEndUtc: stream.onset.windowEndUtc,
    baselineRate: stream.onset.baselineRate,
    peakRate: stream.onset.peakRate,
    explanation: stream.onset.explanation,
  };
  return {
    schemaVersion: stream.schemaVersion,
    analysisVersion: stream.analysisVersion,
    scoringVersion: stream.scoringVersion,
    provenance: { ...stream.provenance },
    limits: { ...stream.limits },
    warnings: [...stream.warnings],
    assumptions: [...stream.assumptions],
    diagnostics: stream.diagnostics.map((diagnostic) => ({ ...diagnostic })),
    incident: {
      status: stream.onset.class,
      interpretation: incidentInterpretation(stream.onset.class),
      onset: onsetSummary,
    },
    errors: stream.errors.map((group) => ({
      ...group,
      eventIds: [...group.eventIds],
      stackFrames: group.stackFrames.map((frame) => ({ ...frame })),
      ...(group.rawMessages === undefined ? {} : { rawMessages: [...group.rawMessages] }),
      ...(group.warnings === undefined ? {} : { warnings: [...group.warnings] }),
      ...(group.diagnostics === undefined ? {} : { diagnostics: [...group.diagnostics] }),
    })),
    timeline: stream.timeline.map((point) => ({ ...point, errorGroupSignatures: [...point.errorGroupSignatures], commitShas: [] })),
    suspects: [],
    confidence: confidenceFor(stream.onset.class),
    tieBreak: {
      rule: 'score descending, trace match descending, commit time descending, SHA ascending',
      appliedOrder: ['score', 'trace-match', 'committedAtUtc', 'sha'],
    },
  };
}
