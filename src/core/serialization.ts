import type {
  AnalysisResult,
  CommitDisposition,
  Diagnostic,
  EvidenceReference,
  ErrorGroup,
  RankingSummary,
  ScoredSuspect,
  SignalContribution,
  StackFrame,
  TimelinePoint,
  TraceSummary,
} from './model';
import { CONFIDENCE_LABEL_ORDER } from './model';
import { compareText, normalizeRepositoryPath, normalizeTimestampUtc } from './normalization';
import { escapeMarkdown, inlineCode } from './markdown';
import { SIGNAL_ORDER } from './scoring';

export { normalizeRepositoryPath } from './normalization';

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

function canonicalTraceSummary(summary: TraceSummary): TraceSummary {
  return {
    matchKind: summary.matchKind,
    matchedErrorCount: finiteNumber(summary.matchedErrorCount, 'matched error count'),
    lineLevelErrorCount: finiteNumber(summary.lineLevelErrorCount, 'line-level error count'),
    totalErrorCount: finiteNumber(summary.totalErrorCount, 'total error count'),
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
    timeGapMinutes: finiteNumber(suspect.timeGapMinutes, 'time gap minutes'),
    traceSummary: canonicalTraceSummary(suspect.traceSummary),
    signals: [...suspect.signals]
      .sort((left, right) => SIGNAL_ORDER.indexOf(left.signal) - SIGNAL_ORDER.indexOf(right.signal))
      .map(canonicalSignal),
    evidenceReferences: canonicalEvidenceList(suspect.evidenceReferences),
    tieBreakKey: suspect.tieBreakKey,
  };
}

function canonicalDisposition(entry: CommitDisposition): CommitDisposition {
  return {
    sha: entry.sha,
    shortSha: entry.shortSha,
    subject: entry.subject,
    author: entry.author,
    committedAtUtc: utcTimestamp(entry.committedAtUtc, 'committedAtUtc'),
    status: entry.status,
    rank: entry.rank === null ? null : finiteNumber(entry.rank, 'disposition rank'),
    score: entry.score === null ? null : finiteNumber(entry.score, 'disposition score'),
    reason: entry.reason,
  };
}

function canonicalRanking(ranking: RankingSummary): RankingSummary {
  return {
    status: ranking.status,
    referenceUtc: ranking.referenceUtc === null ? null : utcTimestamp(ranking.referenceUtc, 'ranking referenceUtc'),
    eligibleCount: finiteNumber(ranking.eligibleCount, 'eligible count'),
    considered: ranking.considered
      .map(canonicalDisposition)
      .sort((left, right) => compareText(left.committedAtUtc, right.committedAtUtc) || compareText(left.sha, right.sha)),
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
 * the frozen signal order, evidence by its complete reference key, confidence
 * labels by the fixed label order, and considered commits by committed time then SHA.
 * Suspect, ranking and disposition keys are emitted in their declared order.
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
    ranking: canonicalRanking(result.ranking),
    confidence: {
      band: result.confidence.band,
      labels: CONFIDENCE_LABEL_ORDER.filter((label) => result.confidence.labels.includes(label)),
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
    return `- ${reference.type}: ${inlineCode(location)} — ${escapeMarkdown(reference.detail)}`;
  });
}

function markdownDispositions(ranking: RankingSummary): string[] {
  const lines: string[] = [];
  for (const entry of ranking.considered) {
    if (entry.status === 'scored') {
      lines.push(`- Also scored: #${entry.rank ?? 0} ${inlineCode(entry.shortSha)} — ${escapeMarkdown(entry.subject)} — score ${entry.score ?? 0}`);
    } else if (entry.status === 'excluded') {
      lines.push(`- Not eligible: ${inlineCode(entry.shortSha)} — ${escapeMarkdown(entry.subject)} — ${escapeMarkdown(entry.reason ?? 'excluded from ranking')}`);
    }
  }
  return lines;
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
        `- Explanation: ${escapeMarkdown(onset.explanation)}`,
      ];
  const leader = canonical.suspects[0];
  const verdictLines = [
    `- Interpretation: ${escapeMarkdown(canonical.incident.interpretation)}`,
    `- Confidence: **${canonical.confidence.band}**`,
    `- Labels: ${canonical.confidence.labels.length === 0 ? 'none' : canonical.confidence.labels.join(', ')}`,
    ...(leader === undefined
      ? []
      : [`- Leading suspect: ${inlineCode(leader.shortSha)} — ${escapeMarkdown(leader.subject)} — ${escapeMarkdown(leader.author)}, committed ${leader.committedAtUtc}, ${leader.timeGapMinutes} min before the onset window start`]),
    '- Scores are ranked suspicion, not probability or proof of causality.',
  ];
  const suspectLines = [
    ...(canonical.suspects.length === 0 ? ['- No eligible suspect commits were scored.'] : []),
    ...canonical.suspects.map((suspect) => `- #${suspect.rank} ${inlineCode(suspect.shortSha)} — ${escapeMarkdown(suspect.subject)} — ${escapeMarkdown(suspect.author)}, committed ${suspect.committedAtUtc}, ${suspect.timeGapMinutes} min before onset window start — score ${suspect.score}`),
    ...markdownDispositions(canonical.ranking),
  ];
  const evidenceLines = canonical.suspects.flatMap((suspect) => [
    `### #${suspect.rank} ${inlineCode(suspect.shortSha)} · ${escapeMarkdown(suspect.subject)}`,
    ...markdownEvidence(suspect.evidenceReferences),
    ...suspect.signals.map((signal) => `- ${signal.signal}: value ${signal.value} × weight ${signal.weight} = contribution ${signal.contribution} — ${escapeMarkdown(signal.explanation)}`),
    `- Total score: ${suspect.score} (sum of the contributions above)`,
  ]);
  const warningLines = [
    ...canonical.warnings.map((warning) => `- Warning: ${escapeMarkdown(warning)}`),
    ...canonical.diagnostics.map((diagnostic) => `- Diagnostic ${inlineCode(`${diagnostic.source}/${diagnostic.code}`)}${diagnostic.line === null ? '' : ` line ${diagnostic.line}`}: ${escapeMarkdown(diagnostic.message)}`),
  ];
  const caveatLines = [
    `- Rationale: ${escapeMarkdown(canonical.confidence.rationale)}`,
    `- Score separation: ${canonical.confidence.scoreSeparation ?? 'not available'}`,
    `- Evidence completeness: ${canonical.confidence.evidenceCompleteness}`,
    `- Ranking: ${canonical.ranking.status}; eligible commits: ${canonical.ranking.eligibleCount}; reference (UTC): ${canonical.ranking.referenceUtc ?? 'none'}`,
    ...canonical.assumptions.map((assumption) => `- Assumption: ${escapeMarkdown(assumption)}`),
  ];
  const sections = [
    '# Culprit analysis',
    `## Verdict\n${verdictLines.join('\n')}`,
    `## Onset\n${onsetLines.join('\n')}`,
    `## Top suspects\n${suspectLines.join('\n')}`,
    `## Evidence\n${evidenceLines.length === 0 ? '- No suspect evidence recorded.' : evidenceLines.join('\n')}`,
    `## Confidence and caveats\n${caveatLines.join('\n')}`,
    `## Provenance\n- Logs: ${inlineCode(canonical.provenance.logSource)} (${canonical.provenance.logFormat}, ${canonical.provenance.eventCount} events)\n- History: ${inlineCode(canonical.provenance.historySource)} (${canonical.provenance.historyFormat}, ${canonical.provenance.commitCount} commits)\n- Analysis: ${canonical.analysisVersion}; scoring: ${canonical.scoringVersion}; schema: ${canonical.schemaVersion}\n- Limits: ${canonical.limits.maxLogBytes} bytes of log text, ${canonical.limits.maxEvents} events, ${canonical.limits.maxStackLines} stack lines per event; input truncated: ${canonical.limits.truncated ? 'yes' : 'no'}`,
    `## UTC disclosure\nAll timestamps in this report are normalized to UTC and rendered with an explicit \`Z\` suffix. The result contains no wall-clock generation time.`,
    `## Warnings and diagnostics\n${warningLines.length === 0 ? '- None.' : warningLines.join('\n')}`,
  ];
  return `${sections.join('\n\n').trimEnd()}\n`;
}
