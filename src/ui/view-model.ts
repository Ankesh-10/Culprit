import { CONFIDENCE_LABEL_ORDER } from '../core/model';
import type {
  AnalysisStream,
  CommitDispositionStatus,
  ConfidenceBand,
  ConfidenceLabel,
  EvidenceReference,
  ScoredSuspect,
} from '../core/model';
import { toAnalysisResult } from '../core/pipeline';
import {
  formatGapShort,
  formatInteger,
  formatMiB,
  formatPathRange,
  formatScore,
  formatTimeGap,
  formatUtcDateTime,
  plural,
  traceMatchLabel,
} from './format';
import type { PageState } from './state';
import type { AnalysisFailure, UiDiagnostic } from '../worker/protocol';

export type ResultKind = 'completed' | 'low-confidence' | 'no-incident' | 'insufficient-data' | 'no-eligible-commits';

export const STANDING_CAVEAT = 'Ranked suspicion from log timing and stack evidence. Verify the diff before acting.';

export function deriveResultKind(stream: AnalysisStream): ResultKind {
  const onsetClass = stream.onset.class;
  if (onsetClass === 'none') return 'no-incident';
  if (onsetClass === 'insufficient-data') return 'insufficient-data';
  const { status, confidence } = stream.ranking;
  if (status === 'no-onset') return 'no-incident';
  if (status === 'no-eligible-commits') return 'no-eligible-commits';
  if (confidence.band === 'low' || confidence.labels.length > 0) return 'low-confidence';
  return 'completed';
}

export interface VerdictFact {
  key: 'author' | 'committed' | 'gap' | 'onset' | 'files' | 'matches';
  label: string;
  value: string;
  values?: string[];
  moreCount?: number;
  mono?: boolean;
}

export interface VerdictView {
  heading: string;
  confidence: {
    band: ConfidenceBand;
    filled: number;
    text: string;
    ariaLabel: string;
    hasLabels: boolean;
  };
  caution: { lead: string; chips: string[] } | null;
  headline: {
    mode: 'suspect' | 'no-clear-culprit';
    shortSha: string;
    subject: string;
  };
  interpretation: string;
  facts: VerdictFact[];
  traceChip: string;
  score: { value: number; text: string; fraction: number };
  scoreHelper: string;
  evidencePreview: string[];
  caveat: string;
}

const FILLED: Record<ConfidenceBand, number> = { high: 3, medium: 2, low: 1 };
const BAND_WORD: Record<ConfidenceBand, string> = { high: 'High', medium: 'Medium', low: 'Low' };

export const CAUTION_LEAD = 'Low confidence. Treat these as leads to check, not a diagnosis.';
export const SCORE_HELPER = 'Suspicion score from 0 to 1. This is ranked suspicion, not probability.';
export const NO_RANGES_TEXT = 'No changed line ranges recorded';

const LABEL_CHIP: Record<ConfidenceLabel, string> = {
  'low-confidence': 'Low confidence',
  ambiguous: 'Ambiguous',
  'weak-evidence': 'Weak evidence',
  'no-clear-culprit': 'No clear culprit',
};

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function matchesText(suspect: ScoredSuspect): string {
  const { matchedErrorCount, totalErrorCount } = suspect.traceSummary;
  return `Matches ${matchedErrorCount} of ${plural(totalErrorCount, 'error')}`;
}

/** Unique file-range references with a path, in evidence order. */
function uniqueFileRanges(references: readonly EvidenceReference[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const reference of references) {
    if (reference.type !== 'file-range' || reference.path === null) continue;
    const text = formatPathRange(reference.path, reference.lineStart, reference.lineEnd);
    if (seen.has(text)) continue;
    seen.add(text);
    result.push(text);
  }
  return result;
}

function filesFact(suspect: ScoredSuspect): VerdictFact {
  const unique = uniqueFileRanges(suspect.evidenceReferences);
  if (unique.length === 0) {
    return { key: 'files', label: 'Files and lines', value: NO_RANGES_TEXT, values: [], moreCount: 0 };
  }
  const shown = unique.slice(0, 2);
  return {
    key: 'files',
    label: 'Files and lines',
    value: shown.join(', '),
    values: shown,
    moreCount: unique.length - shown.length,
    mono: true,
  };
}

export function buildVerdictView(stream: AnalysisStream): VerdictView | null {
  const kind = deriveResultKind(stream);
  if (kind === 'no-incident' || kind === 'insufficient-data' || kind === 'no-eligible-commits') return null;
  const leading = stream.ranking.suspects[0];
  if (leading === undefined) return null;
  const { band, labels } = stream.ranking.confidence;
  const filled = FILLED[band];
  const chips = CONFIDENCE_LABEL_ORDER.filter((label) => labels.includes(label)).map((label) => LABEL_CHIP[label]);
  const caution = band === 'low' || chips.length > 0 ? { lead: CAUTION_LEAD, chips } : null;
  return {
    heading: 'Most likely suspect',
    confidence: {
      band,
      filled,
      text: `Ranking confidence: ${BAND_WORD[band]}`,
      ariaLabel: `Ranking confidence: ${band}, ${filled} of 3`,
      hasLabels: labels.length > 0,
    },
    caution,
    headline: {
      mode: labels.includes('no-clear-culprit') ? 'no-clear-culprit' : 'suspect',
      shortSha: leading.shortSha,
      subject: leading.subject,
    },
    interpretation: toAnalysisResult(stream).incident.interpretation,
    facts: [
      { key: 'author', label: 'Author', value: leading.author },
      { key: 'committed', label: 'Committed', value: formatUtcDateTime(leading.committedAtUtc) },
      { key: 'gap', label: 'Time gap', value: formatTimeGap(leading.timeGapMinutes) },
      { key: 'onset', label: 'Onset', value: stream.onset.explanation },
      filesFact(leading),
      { key: 'matches', label: 'Matching errors', value: matchesText(leading) },
    ],
    traceChip: traceMatchLabel(leading.traceSummary.matchKind),
    score: { value: leading.score, text: formatScore(leading.score, 2), fraction: clamp01(leading.score) },
    scoreHelper: SCORE_HELPER,
    evidencePreview: leading.evidenceReferences.slice(0, 3).map((reference) => reference.detail),
    caveat: STANDING_CAVEAT,
  };
}

export interface ShortlistRow {
  rank: number;
  rankLabel: string;
  leading: boolean;
  diamond: 'leading' | 'ranked';
  shortSha: string;
  subject: string;
  byline: string;
  gap: string;
  scoreText: string;
  scoreFraction: number;
  traceChip: string;
  matches: string;
}

export interface ShortlistView {
  heading: 'Suspect lineup';
  countText: string;
  rows: ShortlistRow[];
}

export interface ConsideredRow {
  rank: string;
  shortSha: string;
  subject: string;
  status: 'Top three' | 'Scored' | 'Excluded';
  score: string;
  reason: string;
}

const EM_DASH = '—';
const MIDDLE_DOT = '·';

export function buildShortlistView(stream: AnalysisStream): ShortlistView | null {
  const suspects = toAnalysisResult(stream).suspects;
  if (suspects.length === 0) return null;
  const rows = suspects.map((suspect, index): ShortlistRow => {
    const leading = index === 0;
    return {
      rank: suspect.rank,
      rankLabel: `#${suspect.rank}`,
      leading,
      diamond: leading ? 'leading' : 'ranked',
      shortSha: suspect.shortSha,
      subject: suspect.subject,
      byline: `${suspect.author} ${MIDDLE_DOT} ${formatUtcDateTime(suspect.committedAtUtc)}`,
      gap: formatGapShort(suspect.timeGapMinutes),
      scoreText: formatScore(suspect.score, 2),
      scoreFraction: clamp01(suspect.score),
      traceChip: traceMatchLabel(suspect.traceSummary.matchKind),
      matches: matchesText(suspect),
    };
  });
  return { heading: 'Suspect lineup', countText: plural(rows.length, 'suspect'), rows };
}

const DISPOSITION_STATUS: Record<CommitDispositionStatus, ConsideredRow['status']> = {
  'top-three': 'Top three',
  scored: 'Scored',
  excluded: 'Excluded',
};

export function buildConsideredRows(stream: AnalysisStream): { summary: string; rows: ConsideredRow[] } {
  const rows = toAnalysisResult(stream).ranking.considered.map(
    (entry): ConsideredRow => ({
      rank: entry.rank === null ? EM_DASH : String(entry.rank),
      shortSha: entry.shortSha,
      subject: entry.subject,
      status: DISPOSITION_STATUS[entry.status],
      score: entry.score === null ? EM_DASH : formatScore(entry.score, 2),
      reason: entry.reason ?? '',
    }),
  );
  return { summary: `Commits considered (${rows.length})`, rows };
}

export type StatusIcon = 'info' | 'loader' | 'x-circle' | 'alert-triangle' | 'check-circle';
export type StatusTone = 'neutral' | 'good' | 'warning' | 'critical';

export interface StatusView {
  icon: StatusIcon;
  tone: StatusTone;
  /** Visible banner text; null while a quick load has not yet crossed the banner delay. */
  label: string | null;
  /** Text for the polite live region. */
  announcement: string;
  warningChip: string | null;
}

export interface StatePanel {
  heading: string;
  body: string;
}

export const ERROR_HEADING = "We couldn't analyze these inputs";
export const ERROR_BODY =
  'Nothing was uploaded and nothing changed. Fix the item below and analyze again, or load a bundled incident to compare formats.';
export const LOADING_LABEL = 'Analyzing locally...';

export interface ErrorEntry {
  field: 'log' | 'history' | 'analysis';
  code: string;
  text: string;
  fixTarget: 'log' | 'history' | null;
}

export interface ErrorSummary {
  heading: typeof ERROR_HEADING;
  body: typeof ERROR_BODY;
  entries: ErrorEntry[];
  moreText: string | null;
}

export const MAX_ERROR_ENTRIES = 20;

const UNSUPPORTED_TEXT =
  "This format isn't supported. Use a JSON-lines log or plain text with ISO timestamps and levels, plus a Culprit JSON history export. The README lists the supported formats.";
const LIMIT_TEXT = 'This input is over the limit of 1 MiB or 10,000 events. Trim the log to the incident window and try again.';

const FIELD_NOUN: Record<ErrorEntry['field'], string> = {
  log: 'log',
  history: 'git history',
  analysis: 'analysis input',
};

function fieldOf(source: string, sources: { logs: string; history: string }): ErrorEntry['field'] {
  if (source === sources.logs || source === 'logs') return 'log';
  if (source === sources.history || source === 'history') return 'history';
  return 'analysis';
}

function entryText(diagnostic: UiDiagnostic, noun: string): string {
  switch (diagnostic.code) {
    case 'EMPTY_INPUT':
      return `The ${noun} is empty. Choose a file or paste text, then analyze again.`;
    case 'MALFORMED_RECORD':
      if (diagnostic.line !== null) {
        return `Line ${diagnostic.line} of the ${noun} couldn't be read. Fix or remove that line, then analyze again.`;
      }
      if (diagnostic.record !== null) {
        return `Record ${diagnostic.record} of the ${noun} couldn't be read. Fix or remove that record, then analyze again.`;
      }
      return `The ${noun} couldn't be read. Fix the file, then analyze again.`;
    case 'UNSUPPORTED_FORMAT':
      return UNSUPPORTED_TEXT;
    case 'INPUT_LIMIT':
      return LIMIT_TEXT;
    default:
      return `Check ${noun}: ${diagnostic.message}${diagnostic.line === null ? '' : ` (line ${diagnostic.line})`}`;
  }
}

/**
 * Plain-language, field-mapped problems for a failed analysis. `sources` are the two source names the UI
 * passed to the analysis, so a diagnostic maps to the Log or Git history field by equality.
 */
export function buildErrorSummary(failure: AnalysisFailure, sources: { logs: string; history: string }): ErrorSummary {
  const all: ErrorEntry[] =
    failure.diagnostics.length === 0
      ? [{ field: 'analysis', code: failure.code, text: failure.message, fixTarget: null }]
      : failure.diagnostics.map((diagnostic): ErrorEntry => {
          const field = fieldOf(diagnostic.source, sources);
          return {
            field,
            code: diagnostic.code,
            text: entryText(diagnostic, FIELD_NOUN[field]),
            fixTarget: field === 'analysis' ? null : field,
          };
        });
  const hidden = all.length - MAX_ERROR_ENTRIES;
  return {
    heading: ERROR_HEADING,
    body: ERROR_BODY,
    entries: all.slice(0, MAX_ERROR_ENTRIES),
    moreText: hidden > 0 ? `${hidden} more diagnostics are not shown.` : null,
  };
}

export const EMPTY_STATE: StatePanel = {
  heading: 'Load an incident to see which commits to check first',
  body: 'Choose a bundled case to see Culprit work in seconds, or add your own log and git history. Everything stays in this browser.',
};

const STATE_PANELS: Record<'no-incident' | 'insufficient-data' | 'no-eligible-commits', StatePanel> = {
  'no-incident': {
    heading: 'No incident detected',
    body: "The log shows no sustained rise in errors, so there is no onset to trace back from. Culprit doesn't rank commits without one. Check that your log covers the failure window.",
  },
  'insufficient-data': {
    heading: 'Not enough data to find an onset.',
    body: 'The log has too few errors or too short a time span. Add more of the log from before and during the failure.',
  },
  'no-eligible-commits': {
    heading: 'No commits before the onset.',
    body: 'Every supplied commit landed after the onset window started, so none can be ranked as a suspect. Add earlier history to compare.',
  },
};

export function buildStatePanel(stream: AnalysisStream): StatePanel | null {
  const kind = deriveResultKind(stream);
  if (kind === 'no-incident' || kind === 'insufficient-data' || kind === 'no-eligible-commits') {
    return STATE_PANELS[kind];
  }
  return null;
}

function warningChip(stream: AnalysisStream): string | null {
  const count = stream.warnings.length;
  if (count > 0) return plural(count, 'warning');
  return stream.limits.truncated ? 'Input truncated' : null;
}

function doneStatus(stream: AnalysisStream): StatusView {
  const kind = deriveResultKind(stream);
  const chip = warningChip(stream);
  const leading = stream.ranking.suspects[0];
  const sha = leading?.shortSha ?? '';
  const band = stream.ranking.confidence.band;
  switch (kind) {
    case 'completed':
      return {
        icon: 'check-circle',
        tone: 'good',
        label: 'Analysis complete',
        announcement: `Analysis complete. Top suspect ${sha}, ${band} ranking confidence.`,
        warningChip: chip,
      };
    case 'low-confidence':
      return {
        icon: 'alert-triangle',
        tone: 'warning',
        label: 'Low confidence — treat as leads, not a diagnosis',
        announcement: `Analysis complete with ${band} ranking confidence. Leading candidate ${sha}; treat it as a lead, not a diagnosis.`,
        warningChip: chip,
      };
    case 'no-incident':
      return { icon: 'info', tone: 'neutral', label: 'No incident detected', announcement: 'No incident detected.', warningChip: chip };
    case 'insufficient-data':
      return {
        icon: 'info',
        tone: 'neutral',
        label: 'Not enough data to find an onset',
        announcement: 'Not enough data to find an onset.',
        warningChip: chip,
      };
    case 'no-eligible-commits':
      return {
        icon: 'alert-triangle',
        tone: 'warning',
        label: 'No commits before the onset',
        announcement: 'No commits before the onset.',
        warningChip: chip,
      };
  }
}

export function buildStatusView(state: PageState): StatusView {
  switch (state.phase) {
    case 'idle':
      return { icon: 'info', tone: 'neutral', label: 'Ready — no incident loaded', announcement: '', warningChip: null };
    case 'loading':
      return {
        icon: state.showBanner ? 'loader' : 'info',
        tone: 'neutral',
        label: state.showBanner ? LOADING_LABEL : null,
        announcement: 'Analyzing incident.',
        warningChip: null,
      };
    case 'error':
      return { icon: 'x-circle', tone: 'critical', label: ERROR_HEADING, announcement: `${ERROR_HEADING}.`, warningChip: null };
    case 'done':
      return doneStatus(state.stream);
  }
}

export interface TrustFooterItem {
  code: string | null;
  line: string | null;
  message: string;
}

export interface TrustFooterView {
  heading: string;
  countChip: string | null;
  items: TrustFooterItem[];
  assumptionsSummary: string;
  rationale: string;
  assumptions: string[];
  versions: string;
  provenance: string[];
  limits: string;
  utcNote: string;
  truncationBanner: string | null;
}

export const TRUST_FOOTER_HEADING = 'Warnings and caveats';
export const ASSUMPTIONS_SUMMARY = 'UTC · local · not proof';
export const UTC_NOTE = 'All timestamps are normalized to UTC and shown without local conversion.';
export const TRUNCATION_BANNER = 'Input was truncated at the limit; results use only the lines that were read.';

const MIB = 1048576;

function formatLimitBytes(bytes: number): string {
  return bytes % MIB === 0 ? `${bytes / MIB} MiB` : formatMiB(bytes);
}

/** Warnings first, then diagnostics; the count chip counts both. Every caveat is data from the stream. */
export function buildTrustFooterView(stream: AnalysisStream): TrustFooterView {
  const items: TrustFooterItem[] = [
    ...stream.warnings.map((message): TrustFooterItem => ({ code: null, line: null, message })),
    ...stream.diagnostics.map(
      (diagnostic): TrustFooterItem => ({
        code: `${diagnostic.source}/${diagnostic.code}`,
        line: diagnostic.line === null ? null : `line ${diagnostic.line}`,
        message: diagnostic.message,
      }),
    ),
  ];
  const { limits, provenance } = stream;
  return {
    heading: TRUST_FOOTER_HEADING,
    countChip: items.length === 0 ? null : plural(items.length, 'warning'),
    items,
    assumptionsSummary: ASSUMPTIONS_SUMMARY,
    rationale: stream.ranking.confidence.rationale,
    assumptions: [...stream.assumptions],
    versions: `${stream.analysisVersion} · ${stream.scoringVersion} · schema ${stream.schemaVersion}`,
    provenance: [
      `Logs: ${provenance.logSource} (${provenance.logFormat}, ${plural(provenance.eventCount, 'event')})`,
      `History: ${provenance.historySource} (${provenance.historyFormat}, ${plural(provenance.commitCount, 'commit')})`,
    ],
    limits: `Limits: ${formatLimitBytes(limits.maxLogBytes)} of log text, ${formatInteger(limits.maxEvents)} events, ${formatInteger(limits.maxStackLines)} stack lines per event`,
    utcNote: UTC_NOTE,
    truncationBanner: limits.truncated ? TRUNCATION_BANNER : null,
  };
}
