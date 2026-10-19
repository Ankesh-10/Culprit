/** The public result boundary is intentionally JSON-serializable and versioned. */
export const SCHEMA_VERSION = 1 as const;
export const ANALYSIS_VERSION = 'analysis-v1' as const;
export const SCORING_VERSION = 'scoring-v1' as const;

export type SchemaVersion = typeof SCHEMA_VERSION;
export type AnalysisVersion = typeof ANALYSIS_VERSION;
export type ScoringVersion = typeof SCORING_VERSION;
export type TimestampUtc = string;

export type LogFormat = 'jsonl' | 'plain-text';
export type HistoryFormat = 'culprit-json' | 'git-log';
export type OnsetClass = 'spike' | 'ramp' | 'none' | 'insufficient-data' | 'ambiguous';
export type ConfidenceBand = 'high' | 'medium' | 'low';
export type SignalName = 'proximity' | 'trace-match' | 'novelty' | 'churn';
export type EvidenceType = 'log-event' | 'error-group' | 'file-range' | 'feature';
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface Provenance {
  logSource: string;
  historySource: string;
  logFormat: LogFormat;
  historyFormat: HistoryFormat;
  eventCount: number;
  commitCount: number;
}

export interface AnalysisLimits {
  maxLogBytes: number;
  maxEvents: number;
  maxStackLines: number;
  truncated: boolean;
}

export interface Diagnostic {
  source: 'logs' | 'history' | 'analysis';
  code: string;
  message: string;
  line: number | null;
  record: number | null;
}

export interface OnsetSummary {
  class: OnsetClass;
  windowStartUtc: TimestampUtc | null;
  windowEndUtc: TimestampUtc | null;
  baselineRate: number;
  peakRate: number;
  explanation: string;
}

export interface IncidentSummary {
  status: OnsetClass;
  interpretation: string;
  onset: OnsetSummary | null;
}

export interface StackFrame {
  filePath: string | null;
  line: number | null;
  column: number | null;
  functionName: string | null;
  vendor: boolean;
}

export interface LogSourceRef {
  source: string;
  line: number | null;
  record: number | null;
}

export interface LogEvent {
  eventId: string;
  timestampUtc: TimestampUtc;
  level: LogLevel;
  message: string;
  rawMessage: string;
  exception: string | null;
  stack: string | null;
  stackFrames: StackFrame[];
  source: LogSourceRef;
  rawLine: string;
}

export interface ParsedLogDocument {
  format: LogFormat;
  source: string;
  events: LogEvent[];
  diagnostics: import('./input-errors').InputDiagnostic[];
}

export interface ChangedLineRange {
  start: number;
  end: number;
}

export interface ChangedFile {
  path: string;
  added: number;
  deleted: number;
  ranges: ChangedLineRange[];
}

export interface GitCommit {
  sha: string;
  author: string;
  message: string;
  subject: string;
  timestampUtc: TimestampUtc;
  files: ChangedFile[];
  source: LogSourceRef;
}

export interface GitHistoryDocument {
  schemaVersion: 1;
  format: 'culprit-json';
  repository: string;
  commits: GitCommit[];
  diagnostics: import('./input-errors').InputDiagnostic[];
}

export interface ErrorGroup {
  signature: string;
  representativeMessage: string;
  count: number;
  firstSeenUtc: TimestampUtc;
  lastSeenUtc: TimestampUtc;
  eventIds: string[];
  stackFrames: StackFrame[];
  /** Raw message variants are retained as audit evidence; the signature is normalized. */
  rawMessages?: string[];
  /** Group-local warnings explain missing or ambiguous stack ownership. */
  warnings?: string[];
  diagnostics?: string[];
}

export interface SignatureCount {
  signature: string;
  count: number;
}

/** A fixed-width, half-open UTC interval in the deterministic error series. */
export interface UtcBucket {
  bucketStartUtc: TimestampUtc;
  bucketEndUtc: TimestampUtc;
  errorCount: number;
  signatureCounts: Record<string, number>;
  eventIds: string[];
  errorGroupSignatures: string[];
  /** Reserved for Phase 3 history correlation. */
  commitShas: string[];
}

export type OnsetClassification = Extract<OnsetClass, 'spike' | 'ramp' | 'none' | 'insufficient-data'>;

export interface OnsetAnalysis {
  /** The classifier name used by new callers. */
  classification: OnsetClassification;
  /** Wire-compatible spelling used by OnsetSummary and the Phase 1 result. */
  class: OnsetClassification;
  buckets: UtcBucket[];
  baselineRate: number;
  peakRate: number;
  onsetBucket: UtcBucket | null;
  onsetWindow: { startUtc: TimestampUtc; endUtc: TimestampUtc } | null;
  windowStartUtc: TimestampUtc | null;
  windowEndUtc: TimestampUtc | null;
  appliedRule: string;
  explanation: string;
}

export interface TimelinePoint {
  bucketStartUtc: TimestampUtc;
  bucketEndUtc: TimestampUtc;
  errorCount: number;
  errorGroupSignatures: string[];
  commitShas: string[];
}

export interface EvidenceReference {
  type: EvidenceType;
  sourceId: string;
  path: string | null;
  lineStart: number | null;
  lineEnd: number | null;
  detail: string;
}

export interface SignalContribution {
  signal: SignalName;
  value: number;
  weight: number;
  contribution: number;
  explanation: string;
  evidenceReferences: EvidenceReference[];
}

export interface ScoredSuspect {
  rank: number;
  sha: string;
  shortSha: string;
  subject: string;
  author: string;
  committedAtUtc: TimestampUtc;
  score: number;
  signals: SignalContribution[];
  evidenceReferences: EvidenceReference[];
  tieBreakKey: string;
}

export interface ConfidenceRationale {
  band: ConfidenceBand;
  rationale: string;
  scoreSeparation: number | null;
  evidenceCompleteness: number;
}

export interface TieBreakMetadata {
  rule: string;
  appliedOrder: string[];
}

export interface AnalysisResult {
  schemaVersion: SchemaVersion;
  analysisVersion: AnalysisVersion;
  scoringVersion: ScoringVersion;
  provenance: Provenance;
  limits: AnalysisLimits;
  warnings: string[];
  assumptions: string[];
  diagnostics: Diagnostic[];
  incident: IncidentSummary;
  errors: ErrorGroup[];
  timeline: TimelinePoint[];
  suspects: ScoredSuspect[];
  confidence: ConfidenceRationale;
  tieBreak: TieBreakMetadata;
}

export interface AnalysisInput {
  logs: { text: string; format: LogFormat };
  history: { text: string; format: HistoryFormat };
  options: { bucketMinutes: number; maxLogBytes: number } | null;
}
