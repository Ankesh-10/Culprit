import type { AnalysisStream, ChangedFile, EvidenceReference, EvidenceType, SignalName } from '../core/model';
import { toAnalysisResult } from '../core/pipeline';
import { formatLineRange, formatPathRange, formatScore, formatTimeGap, formatUtcDateTime, traceMatchLabel } from './format';

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

const EVIDENCE_LABELS: Record<EvidenceType, string> = {
  'log-event': 'Log event',
  'error-group': 'Error group',
  'file-range': 'File range',
  feature: 'Feature',
};

const MINUS = '−';

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

/** The smallest cited stack-frame line of this path that falls inside the inclusive range, else null. */
function overlapText(references: readonly EvidenceReference[], path: string, start: number, end: number): string | null {
  let smallest: number | null = null;
  for (const reference of references) {
    if (reference.type !== 'log-event' || reference.path !== path || reference.lineStart === null) continue;
    if (reference.lineStart < start || reference.lineStart > end) continue;
    if (smallest === null || reference.lineStart < smallest) smallest = reference.lineStart;
  }
  return smallest === null ? null : `Overlaps stack frame at line ${smallest}`;
}

function buildFile(file: ChangedFile, references: readonly EvidenceReference[]): DrawerFile {
  return {
    path: file.path,
    counts: `+${file.added} ${MINUS}${file.deleted}`,
    ranges: file.ranges.map((range) => ({
      text: formatLineRange(range.start, range.end),
      overlap: overlapText(references, file.path, range.start, range.end),
    })),
  };
}

/** Event id to the signature of the error group that owns it. */
function signatureByEventId(stream: AnalysisStream): Map<string, string> {
  const owners = new Map<string, string>();
  for (const group of stream.errors) {
    for (const eventId of group.eventIds) if (!owners.has(eventId)) owners.set(eventId, group.signature);
  }
  return owners;
}

function evidenceAction(reference: EvidenceReference, owners: ReadonlyMap<string, string>): { signature: string } | null {
  if (reference.type === 'error-group') return { signature: reference.sourceId };
  if (reference.type === 'log-event') {
    const signature = owners.get(reference.sourceId);
    return signature === undefined ? null : { signature };
  }
  return null;
}

/** The drawer for the suspect with this rank, or null when the lineup has no such rank. */
export function buildDrawerView(stream: AnalysisStream, rank: number): DrawerView | null {
  const suspects = toAnalysisResult(stream).suspects;
  const owners = signatureByEventId(stream);
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
    files: (stream.commits.find((commit) => commit.sha === suspect.sha)?.files ?? []).map((file) => buildFile(file, suspect.evidenceReferences)),
    diffNote: DIFF_NOTE,
    evidence: suspect.evidenceReferences.map(
      (reference): DrawerEvidenceItem => ({
        typeLabel: EVIDENCE_LABELS[reference.type],
        location: reference.path === null ? null : formatPathRange(reference.path, reference.lineStart, reference.lineEnd),
        detail: reference.detail,
        action: evidenceAction(reference, owners),
      }),
    ),
  };
}

/** The key facts `drawerStepTarget` needs; the drawer builds one from a KeyboardEvent. */
export interface StepKeyEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  /** The key press is part of an IME composition. */
  isComposing: boolean;
  /** The event target is a text field, select or contenteditable element. */
  inEditable: boolean;
}

/** Supplementary single-key shortcuts for suspect stepping, live only while the drawer is open. */
export const DRAWER_STEP_KEYS = { next: 'J', previous: 'K' } as const;

/**
 * The rank a J or K press moves to, or null when nothing should happen: any other key, a modified key, an IME
 * composition, an editable target, or an end of the lineup (no wrap, matching the disabled buttons).
 */
export function drawerStepTarget(ranks: Pick<DrawerView, 'prevRank' | 'nextRank'>, event: StepKeyEvent): number | null {
  if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.inEditable) return null;
  const key = event.key.toUpperCase();
  if (key === DRAWER_STEP_KEYS.next) return ranks.nextRank;
  if (key === DRAWER_STEP_KEYS.previous) return ranks.prevRank;
  return null;
}
