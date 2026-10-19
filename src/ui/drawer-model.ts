import type { AnalysisStream, SignalName } from '../core/model';
import { toAnalysisResult } from '../core/pipeline';
import { formatScore, formatTimeGap, formatUtcDateTime, traceMatchLabel } from './format';

/** Plain-language titles for the four ranking signals. Titles are static; explanations always come from data. */
export const SIGNAL_TITLES: Record<SignalName, string> = {
  proximity: 'Landed shortly before the onset',
  'trace-match': 'Touches code named in the stack trace',
  novelty: 'Errors are new in this log',
  churn: 'Size of the change',
};

export const DRAWER_CAVEAT =
  'This score ranks suspicion from timing, stack, novelty and change size. It is not proof that this commit caused the incident.';

export const DIFF_NOTE =
  "Culprit's history export lists changed line ranges, not diff text. Open the commit in your repository to read the diff.";

/** Fixed display order of the ranking signals. */
const SIGNAL_ORDER: readonly SignalName[] = ['proximity', 'trace-match', 'novelty', 'churn'];

export interface DrawerSummary {
  author: string;
  committed: string;
  gap: string;
  traceChip: string;
  scoreText: string;
  scoreFraction: number;
  fullSha: string;
}

export interface DrawerSignalRow {
  signal: SignalName;
  title: string;
  math: string;
  /** Share of the signal's weight that its contribution fills, clamped to 0..1. */
  barFraction: number;
  explanation: string;
}

export interface DrawerRange {
  text: string;
  /** `Overlaps stack frame at line N` when a cited stack-frame line falls inside the range. */
  overlap: string | null;
}

export interface DrawerFile {
  path: string;
  counts: string;
  ranges: DrawerRange[];
}

export interface DrawerEvidenceItem {
  typeLabel: string;
  location: string | null;
  detail: string;
  /** Present for error-group and log-event items that map to an error signature. */
  action: { signature: string } | null;
}

export interface DrawerView {
  rank: number;
  title: string;
  subject: string;
  prevRank: number | null;
  nextRank: number | null;
  summary: DrawerSummary;
  signals: DrawerSignalRow[];
  total: string;
  files: DrawerFile[];
  diffNote: string;
  evidence: DrawerEvidenceItem[];
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * The share of the weight a contribution fills. The contribution is `value * weight` rounded to six decimals,
 * so `contribution / weight` is the signal value up to that rounding; the value itself is the exact quotient.
 */
function barFraction(value: number, weight: number): number {
  return weight === 0 ? 0 : clamp01(value);
}

function signalMath(value: number, weight: number, contribution: number): string {
  return `value ${formatScore(value, 3)} × weight ${formatScore(weight, 3)} = ${formatScore(contribution, 3)}`;
}

/** The drawer for the suspect with this rank, or null when the lineup has no such rank. */
export function buildDrawerView(stream: AnalysisStream, rank: number): DrawerView | null {
  const suspects = toAnalysisResult(stream).suspects;
  const index = suspects.findIndex((entry) => entry.rank === rank);
  const suspect = suspects[index];
  if (suspect === undefined) return null;

  const signals: DrawerSignalRow[] = [];
  for (const name of SIGNAL_ORDER) {
    const contribution = suspect.signals.find((entry) => entry.signal === name);
    if (contribution === undefined) continue;
    signals.push({
      signal: name,
      title: SIGNAL_TITLES[name],
      math: signalMath(contribution.value, contribution.weight, contribution.contribution),
      barFraction: barFraction(contribution.value, contribution.weight),
      explanation: contribution.explanation,
    });
  }

  return {
    rank: suspect.rank,
    title: `#${suspect.rank} ${suspect.shortSha}`,
    subject: suspect.subject,
    prevRank: suspects[index - 1]?.rank ?? null,
    nextRank: suspects[index + 1]?.rank ?? null,
    summary: {
      author: suspect.author,
      committed: formatUtcDateTime(suspect.committedAtUtc),
      gap: formatTimeGap(suspect.timeGapMinutes),
      traceChip: traceMatchLabel(suspect.traceSummary.matchKind),
      scoreText: formatScore(suspect.score, 3),
      scoreFraction: clamp01(suspect.score),
      fullSha: suspect.sha,
    },
    signals,
    total: `Total suspicion score ${formatScore(suspect.score, 3)} (sum of the contributions above), rounded for display.`,
    files: [],
    diffNote: '',
    evidence: [],
  };
}
