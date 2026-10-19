import type { AnalysisStream, LogEvent, OnsetAnalysis, TimelinePoint } from '../core/model';
import { compareText } from '../core/normalization';
import { formatUtcInterval, formatUtcSeconds, plural } from './format';

/** Pure selection state and view data for the linked timeline and log lines panel. */

export const LOG_PAGE_SIZE = 100;
const NONE = '—';
const SEPARATOR = ' · ';

export interface InvestigationState {
  selectedIndex: number;
  logPanel: { open: boolean; visible: number };
  tableVisible: number;
}

export type JumpTarget = 'onset' | 'peak' | 'first' | 'last';

export type InvestigationEvent =
  | { type: 'select'; index: number }
  | { type: 'step'; delta: number }
  | { type: 'jump'; target: JumpTarget }
  | { type: 'open-log-lines' }
  | { type: 'close-log-lines' }
  | { type: 'show-more-log-lines' }
  | { type: 'show-more-table-rows' };

export interface InvestigationContext {
  bucketCount: number;
  onsetIndex: number | null;
  peakIndex: number;
}

/** Index of the first maximum error count; 0 for an empty timeline. */
export function peakBucketIndex(timeline: readonly TimelinePoint[]): number {
  let best = 0;
  let bestCount = -1;
  timeline.forEach((point, index) => {
    if (point.errorCount > bestCount) {
      best = index;
      bestCount = point.errorCount;
    }
  });
  return best;
}

/** Index of the bucket that contains the onset window start, or null when there is no onset bucket. */
export function onsetBucketIndex(stream: AnalysisStream): number | null {
  const bucket = stream.onset.onsetBucket;
  if (bucket === null) return null;
  const index = stream.buckets.findIndex((candidate) => candidate.bucketStartUtc === bucket.bucketStartUtc);
  return index < 0 ? null : index;
}

/** The onset interval, else the peak interval, else the first. */
export function defaultBucketIndex(stream: AnalysisStream): number {
  const onset = onsetBucketIndex(stream);
  if (onset !== null) return onset;
  if (stream.timeline.length === 0) return 0;
  return peakBucketIndex(stream.timeline);
}

export function investigationContext(stream: AnalysisStream): InvestigationContext {
  return {
    bucketCount: stream.timeline.length,
    onsetIndex: onsetBucketIndex(stream),
    peakIndex: peakBucketIndex(stream.timeline),
  };
}

export function initialInvestigation(stream: AnalysisStream): InvestigationState {
  return {
    selectedIndex: defaultBucketIndex(stream),
    logPanel: { open: false, visible: LOG_PAGE_SIZE },
    tableVisible: LOG_PAGE_SIZE,
  };
}

function clampIndex(index: number, bucketCount: number): number {
  if (bucketCount <= 0) return 0;
  return Math.min(Math.max(index, 0), bucketCount - 1);
}

function withSelection(state: InvestigationState, index: number): InvestigationState {
  if (index === state.selectedIndex) return state;
  return { ...state, selectedIndex: index, logPanel: { ...state.logPanel, visible: LOG_PAGE_SIZE } };
}

export function reduceInvestigation(
  state: InvestigationState,
  event: InvestigationEvent,
  context: InvestigationContext,
): InvestigationState {
  switch (event.type) {
    case 'select':
      return withSelection(state, clampIndex(event.index, context.bucketCount));
    case 'step':
      return withSelection(state, clampIndex(state.selectedIndex + event.delta, context.bucketCount));
    case 'jump': {
      if (event.target === 'onset') {
        return context.onsetIndex === null ? state : withSelection(state, clampIndex(context.onsetIndex, context.bucketCount));
      }
      if (event.target === 'peak') return withSelection(state, clampIndex(context.peakIndex, context.bucketCount));
      if (event.target === 'first') return withSelection(state, 0);
      return withSelection(state, clampIndex(context.bucketCount - 1, context.bucketCount));
    }
    case 'open-log-lines':
      return state.logPanel.open ? state : { ...state, logPanel: { ...state.logPanel, open: true } };
    case 'close-log-lines':
      return state.logPanel.open ? { ...state, logPanel: { ...state.logPanel, open: false } } : state;
    case 'show-more-log-lines':
      return { ...state, logPanel: { ...state.logPanel, visible: state.logPanel.visible + LOG_PAGE_SIZE } };
    case 'show-more-table-rows':
      return { ...state, tableVisible: state.tableVisible + LOG_PAGE_SIZE };
  }
}

/** Half-open overlap of the interval and the onset window. */
export function insideOnsetWindow(
  point: Pick<TimelinePoint, 'bucketStartUtc' | 'bucketEndUtc'>,
  onset: Pick<OnsetAnalysis, 'windowStartUtc' | 'windowEndUtc'>,
): boolean {
  if (onset.windowStartUtc === null || onset.windowEndUtc === null) return false;
  const pointStart = Date.parse(point.bucketStartUtc);
  const pointEnd = Date.parse(point.bucketEndUtc);
  return pointStart < Date.parse(onset.windowEndUtc) && Date.parse(onset.windowStartUtc) < pointEnd;
}

function shortHashOf(stream: AnalysisStream, sha: string): string {
  const known = stream.ranking.considered.find((row) => row.sha === sha);
  return known === undefined ? sha.slice(0, 7) : known.shortSha;
}

function commitList(stream: AnalysisStream, point: TimelinePoint): string[] {
  return point.commitShas.map((sha) => shortHashOf(stream, sha));
}

export interface Readout {
  text: string;
  /** Equal to `text`: the slider's `aria-valuetext`. */
  valueText: string;
  logButtonLabel: string;
  logCount: number;
}

export function buildReadout(stream: AnalysisStream, state: InvestigationState): Readout {
  const point = stream.timeline[state.selectedIndex];
  const bucket = stream.buckets[state.selectedIndex];
  if (point === undefined || bucket === undefined) {
    return { text: 'No error intervals to plot.', valueText: 'No error intervals to plot.', logButtonLabel: 'Show log lines (0)', logCount: 0 };
  }
  const parts = [
    formatUtcInterval(point.bucketStartUtc, point.bucketEndUtc),
    plural(point.errorCount, 'error'),
    plural(Object.keys(bucket.signatureCounts).length, 'signature'),
  ];
  if (insideOnsetWindow(point, stream.onset)) parts.push('Inside onset window');
  const commits = commitList(stream, point);
  if (commits.length > 0) parts.push(`Commits ${commits.join(', ')}`);
  const text = parts.join(SEPARATOR);
  const logCount = bucket.eventIds.length;
  return { text, valueText: text, logButtonLabel: `Show log lines (${logCount})`, logCount };
}

const eventIndexes = new WeakMap<AnalysisStream, Map<string, LogEvent>>();

function eventIndex(stream: AnalysisStream): Map<string, LogEvent> {
  const existing = eventIndexes.get(stream);
  if (existing !== undefined) return existing;
  const built = new Map<string, LogEvent>();
  for (const event of stream.normalizedEvents) built.set(event.eventId, event);
  eventIndexes.set(stream, built);
  return built;
}

/** Events of the selected interval in time order (timestamp, then event id). */
export function selectLogLines(stream: AnalysisStream, state: InvestigationState): LogEvent[] {
  const bucket = stream.buckets[state.selectedIndex];
  if (bucket === undefined) return [];
  const index = eventIndex(stream);
  const events: LogEvent[] = [];
  for (const id of bucket.eventIds) {
    const event = index.get(id);
    if (event !== undefined) events.push(event);
  }
  return events.sort((left, right) => compareText(left.timestampUtc, right.timestampUtc) || compareText(left.eventId, right.eventId));
}

export interface LogRow {
  line: string;
  time: string;
  level: string;
  message: string;
  stack: string | null;
}

export const LOG_EMPTY_TEXT = 'No log lines in this interval. Pick a highlighted interval or use "Jump to peak".';

export interface LogPanelView {
  heading: string;
  total: number;
  rows: LogRow[];
  hasMore: boolean;
  emptyText: string | null;
}

export function buildLogPanelView(stream: AnalysisStream, state: InvestigationState): LogPanelView {
  const point = stream.timeline[state.selectedIndex];
  const events = selectLogLines(stream, state);
  const interval = point === undefined ? NONE : formatUtcInterval(point.bucketStartUtc, point.bucketEndUtc);
  const rows = events.slice(0, state.logPanel.visible).map(
    (event): LogRow => ({
      line: event.source.line === null ? NONE : String(event.source.line),
      time: formatUtcSeconds(event.timestampUtc),
      level: event.level.toUpperCase(),
      message: event.message,
      stack: event.stack,
    }),
  );
  return {
    heading: `Log lines${SEPARATOR}${interval}${SEPARATOR}${plural(events.length, 'event')}`,
    total: events.length,
    rows,
    hasMore: events.length > rows.length,
    emptyText: events.length === 0 ? LOG_EMPTY_TEXT : null,
  };
}

export interface TableTwinRow {
  index: number;
  interval: string;
  errors: number;
  signatures: number;
  onset: 'Yes' | '—';
  commits: string;
}

export interface TableTwinView {
  rows: TableTwinRow[];
  total: number;
  hasMore: boolean;
}

/** One row per interval (the first `tableVisible`), with the onset flag as text and commits as short hashes. */
export function buildTableTwinRows(stream: AnalysisStream, state: InvestigationState): TableTwinView {
  const total = stream.timeline.length;
  const rows: TableTwinRow[] = [];
  for (let index = 0; index < Math.min(total, state.tableVisible); index += 1) {
    const point = stream.timeline[index];
    const bucket = stream.buckets[index];
    if (point === undefined || bucket === undefined) continue;
    const commits = commitList(stream, point);
    rows.push({
      index,
      interval: formatUtcInterval(point.bucketStartUtc, point.bucketEndUtc),
      errors: point.errorCount,
      signatures: Object.keys(bucket.signatureCounts).length,
      onset: insideOnsetWindow(point, stream.onset) ? 'Yes' : NONE,
      commits: commits.length === 0 ? NONE : commits.join(', '),
    });
  }
  return { rows, total, hasMore: total > rows.length };
}
