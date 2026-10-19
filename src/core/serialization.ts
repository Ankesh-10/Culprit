import type {
  AnalysisResult,
  Diagnostic,
  EvidenceReference,
  ErrorGroup,
  ScoredSuspect,
  SignalContribution,
  StackFrame,
  TimelinePoint,
} from './model';
import { normalizeRepositoryPath, normalizeTimestampUtc } from './normalization';

export { normalizeRepositoryPath } from './normalization';

const SIGNAL_ORDER: SignalContribution['signal'][] = ['proximity', 'trace-match', 'novelty', 'churn'];

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function finiteNumber(value: number, label: string): number {
  if (!Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }
  return Object.is(value, -0) ? 0 : value;
}

function utcTimestamp(value: string, label: string): string {
  try {
    return normalizeTimestampUtc(value);
  } catch (error) {
    throw new Error(`${label} must be a valid ISO timestamp with a UTC offset`, { cause: error });
  }
}

function canonicalEvidence(reference: EvidenceReference): EvidenceReference {
  return {
    type: reference.type,
    sourceId: reference.sourceId,
    path: reference.path === null ? null : normalizeRepositoryPath(reference.path),
    lineStart: reference.lineStart === null ? null : finiteNumber(reference.lineStart, 'lineStart'),
    lineEnd: reference.lineEnd === null ? null : finiteNumber(reference.lineEnd, 'lineEnd'),
    detail: reference.detail,
  };
}

function evidenceKey(reference: EvidenceReference): string {
  return [reference.type, reference.sourceId, reference.path ?? '', reference.lineStart ?? '', reference.lineEnd ?? '', reference.detail].join('|');
}

function canonicalEvidenceList(references: EvidenceReference[]): EvidenceReference[] {
  return references.map(canonicalEvidence).sort((left, right) => compareText(evidenceKey(left), evidenceKey(right)));
}

function canonicalFrame(frame: StackFrame): StackFrame {
  return {
    filePath: frame.filePath === null ? null : normalizeRepositoryPath(frame.filePath),
    line: frame.line === null ? null : finiteNumber(frame.line, 'stack frame line'),
    column: frame.column === null ? null : finiteNumber(frame.column, 'stack frame column'),
    functionName: frame.functionName,
    vendor: frame.vendor,
  };
}

function canonicalErrorGroup(group: ErrorGroup): ErrorGroup {
  return {
    signature: group.signature,
    representativeMessage: group.representativeMessage,
    count: finiteNumber(group.count, 'error count'),
    firstSeenUtc: utcTimestamp(group.firstSeenUtc, 'firstSeenUtc'),
    lastSeenUtc: utcTimestamp(group.lastSeenUtc, 'lastSeenUtc'),
    eventIds: [...group.eventIds].sort(),
    stackFrames: group.stackFrames.map(canonicalFrame),
    ...(group.rawMessages === undefined ? {} : { rawMessages: [...group.rawMessages].sort(compareText) }),
    ...(group.warnings === undefined ? {} : { warnings: [...group.warnings].sort(compareText) }),
    ...(group.diagnostics === undefined ? {} : { diagnostics: [...group.diagnostics].sort(compareText) }),
  };
}

function canonicalTimelinePoint(point: TimelinePoint): TimelinePoint {
  return {
    bucketStartUtc: utcTimestamp(point.bucketStartUtc, 'bucketStartUtc'),
    bucketEndUtc: utcTimestamp(point.bucketEndUtc, 'bucketEndUtc'),
    errorCount: finiteNumber(point.errorCount, 'timeline error count'),
    errorGroupSignatures: [...point.errorGroupSignatures].sort(),
    commitShas: [...point.commitShas].sort(),
  };
}

function canonicalSignal(signal: SignalContribution): SignalContribution {
  return {
    signal: signal.signal,
    value: finiteNumber(signal.value, 'signal value'),
    weight: finiteNumber(signal.weight, 'signal weight'),
    contribution: finiteNumber(signal.contribution, 'signal contribution'),
    explanation: signal.explanation,
    evidenceReferences: canonicalEvidenceList(signal.evidenceReferences),
  };
}

function canonicalSuspect(suspect: ScoredSuspect): ScoredSuspect {
  return {
    rank: finiteNumber(suspect.rank, 'suspect rank'),
    sha: suspect.sha,
    shortSha: suspect.shortSha,
    subject: suspect.subject,
    author: suspect.author,
    committedAtUtc: utcTimestamp(suspect.committedAtUtc, 'committedAtUtc'),
    score: finiteNumber(suspect.score, 'suspect score'),
    signals: [...suspect.signals]
      .sort((left, right) => SIGNAL_ORDER.indexOf(left.signal) - SIGNAL_ORDER.indexOf(right.signal))
      .map(canonicalSignal),
    evidenceReferences: canonicalEvidenceList(suspect.evidenceReferences),
    tieBreakKey: suspect.tieBreakKey,
  };
}

function canonicalDiagnostic(diagnostic: Diagnostic): Diagnostic {
  return {
    source: diagnostic.source,
    code: diagnostic.code,
    message: diagnostic.message,
    line: diagnostic.line === null ? null : finiteNumber(diagnostic.line, 'diagnostic line'),
    record: diagnostic.record === null ? null : finiteNumber(diagnostic.record, 'diagnostic record'),
  };
}

/**
 * Build a stable object in documented order, then stringify it.
 * Arrays are ordered as follows: diagnostics/warnings/assumptions lexically,
 * errors by signature, timeline by bucket start, suspects by rank, signals by
 * the frozen signal order, and evidence by its complete reference key.
 * Optional data uses null rather than omission. Numbers reject non-finite values.
 */
export function canonicalizeResult(result: AnalysisResult): AnalysisResult {
  const errors = result.errors.map(canonicalErrorGroup).sort((left, right) => compareText(left.signature, right.signature));
  const timeline = result.timeline
    .map(canonicalTimelinePoint)
    .sort((left, right) => compareText(left.bucketStartUtc, right.bucketStartUtc));
  const suspects = result.suspects
    .map(canonicalSuspect)
    .sort((left, right) => left.rank - right.rank || compareText(left.sha, right.sha));

  return {
    schemaVersion: result.schemaVersion,
    analysisVersion: result.analysisVersion,
    scoringVersion: result.scoringVersion,
    provenance: {
      logSource: normalizeRepositoryPath(result.provenance.logSource),
      historySource: normalizeRepositoryPath(result.provenance.historySource),
      logFormat: result.provenance.logFormat,
      historyFormat: result.provenance.historyFormat,
      eventCount: finiteNumber(result.provenance.eventCount, 'event count'),
      commitCount: finiteNumber(result.provenance.commitCount, 'commit count'),
    },
    limits: {
      maxLogBytes: finiteNumber(result.limits.maxLogBytes, 'maxLogBytes'),
      maxEvents: finiteNumber(result.limits.maxEvents, 'maxEvents'),
      maxStackLines: finiteNumber(result.limits.maxStackLines, 'maxStackLines'),
      truncated: result.limits.truncated,
    },
    warnings: [...result.warnings].sort(compareText),
    assumptions: [...result.assumptions].sort(compareText),
    diagnostics: result.diagnostics
      .map(canonicalDiagnostic)
      .sort((left, right) => compareText(`${left.source}|${left.line ?? ''}|${left.code}|${left.message}`, `${right.source}|${right.line ?? ''}|${right.code}|${right.message}`)),
    incident: {
      status: result.incident.status,
      interpretation: result.incident.interpretation,
      onset: result.incident.onset === null ? null : {
        class: result.incident.onset.class,
        windowStartUtc: result.incident.onset.windowStartUtc === null ? null : utcTimestamp(result.incident.onset.windowStartUtc, 'onset window start'),
        windowEndUtc: result.incident.onset.windowEndUtc === null ? null : utcTimestamp(result.incident.onset.windowEndUtc, 'onset window end'),
        baselineRate: finiteNumber(result.incident.onset.baselineRate, 'baseline rate'),
        peakRate: finiteNumber(result.incident.onset.peakRate, 'peak rate'),
        explanation: result.incident.onset.explanation,
      },
    },
    errors,
    timeline,
    suspects,
    confidence: {
      band: result.confidence.band,
      rationale: result.confidence.rationale,
      scoreSeparation: result.confidence.scoreSeparation === null ? null : finiteNumber(result.confidence.scoreSeparation, 'score separation'),
      evidenceCompleteness: finiteNumber(result.confidence.evidenceCompleteness, 'evidence completeness'),
    },
    tieBreak: {
      rule: result.tieBreak.rule,
      appliedOrder: [...result.tieBreak.appliedOrder],
    },
  };
}

export function serializeCanonicalJson(result: AnalysisResult): string {
  return JSON.stringify(canonicalizeResult(result));
}

function markdownEvidence(references: EvidenceReference[]): string[] {
  if (references.length === 0) return ['- No direct evidence reference recorded.'];
  return canonicalEvidenceList(references).map((reference) => {
    const location = reference.path === null ? reference.sourceId : `${reference.path}${reference.lineStart === null ? '' : `:${reference.lineStart}${reference.lineEnd === null || reference.lineEnd === reference.lineStart ? '' : `-${reference.lineEnd}`}`}`;
    return `- ${reference.type}: \`${location}\` — ${reference.detail}`;
  });
}

/** Project only structured result data into a fixed-order, UTC-explicit report. */
export function serializeMarkdown(result: AnalysisResult): string {
  const canonical = canonicalizeResult(result);
  const onset = canonical.incident.onset;
  const onsetLines = onset === null
    ? ['- No onset window was established.']
    : [
        `- Class: **${onset.class}**`,
        `- Window (UTC): ${onset.windowStartUtc ?? 'unknown'} → ${onset.windowEndUtc ?? 'unknown'}`,
        `- Baseline / peak rate: ${onset.baselineRate} / ${onset.peakRate}`,
        `- Explanation: ${onset.explanation}`,
      ];
  const suspectLines = canonical.suspects.length === 0
    ? ['- No eligible suspect commits were scored.']
    : canonical.suspects.map((suspect) => `- #${suspect.rank} \`${suspect.shortSha}\` — ${suspect.subject} (${suspect.score.toFixed(3)} suspicion)`);
  const evidenceLines = canonical.suspects.flatMap((suspect) => [
    `### ${suspect.shortSha} · ${suspect.subject}`,
    ...markdownEvidence(suspect.evidenceReferences),
    ...suspect.signals.map((signal) => `- ${signal.signal}: ${signal.explanation} (value ${signal.value}, contribution ${signal.contribution})`),
  ]);
  const warningLines = [
    ...canonical.warnings.map((warning) => `- Warning: ${warning}`),
    ...canonical.diagnostics.map((diagnostic) => `- Diagnostic [${diagnostic.source}/${diagnostic.code}]${diagnostic.line === null ? '' : ` line ${diagnostic.line}`}: ${diagnostic.message}`),
  ];
  const sections = [
    '# Culprit analysis',
    `## Verdict\n- Interpretation: ${canonical.incident.interpretation}\n- Confidence: **${canonical.confidence.band}**`,
    `## Onset\n${onsetLines.join('\n')}`,
    `## Top suspects\n${suspectLines.join('\n')}`,
    `## Evidence\n${evidenceLines.length === 0 ? '- No suspect evidence recorded.' : evidenceLines.join('\n')}`,
    `## Confidence and caveats\n- Rationale: ${canonical.confidence.rationale}\n- Score separation: ${canonical.confidence.scoreSeparation ?? 'not available'}\n- Evidence completeness: ${canonical.confidence.evidenceCompleteness}`,
    `## Provenance\n- Logs: \`${canonical.provenance.logSource}\` (${canonical.provenance.logFormat}, ${canonical.provenance.eventCount} events)\n- History: \`${canonical.provenance.historySource}\` (${canonical.provenance.historyFormat}, ${canonical.provenance.commitCount} commits)\n- Analysis: ${canonical.analysisVersion}; scoring: ${canonical.scoringVersion}; schema: ${canonical.schemaVersion}`,
    `## UTC disclosure\nAll timestamps in this report are normalized to UTC and rendered with an explicit \`Z\` suffix. The result contains no wall-clock generation time.`,
    `## Warnings and diagnostics\n${warningLines.length === 0 ? '- None.' : warningLines.join('\n')}`,
  ];
  return `${sections.join('\n\n').trimEnd()}\n`;
}
