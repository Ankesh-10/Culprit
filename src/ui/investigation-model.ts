import type { AnalysisStream, ErrorGroup, LogEvent, OnsetAnalysis, TimelinePoint, UtcBucket } from '../core/model';
import { compareText } from '../core/normalization';
import { formatUtcDateSeconds, formatUtcInterval, formatUtcSeconds, plural } from './format';

/** Pure selection state and view data for the linked timeline and log lines panel. */

export const LOG_PAGE_SIZE = 100;
const NONE = '—';
const SEPARATOR = ' · ';

/** `bucket`: the selected interval (intersected with the filter); `signature`: every event of the filtered signature. */
export type LogScope = 'bucket' | 'signature';

export interface InvestigationState {
  selectedIndex: number;
  logPanel: { open: boolean; visible: number; scope: LogScope };
  tableVisible: number;
  /** The one error signature the investigation is filtered to, or null. */
  filter: string | null;
}

export type JumpTarget = 'onset' | 'peak' | 'first' | 'last';

export type InvestigationEvent =
  | { type: 'select'; index: number }
  | { type: 'step'; delta: number }
  | { type: 'jump'; target: JumpTarget }
  | { type: 'open-log-lines'; scope?: LogScope }
  | { type: 'close-log-lines' }
  | { type: 'set-filter'; signature: string | null }
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
    logPanel: { open: false, visible: LOG_PAGE_SIZE, scope: 'bucket' },
    tableVisible: LOG_PAGE_SIZE,
    filter: null,
  };
}

function clampIndex(index: number, bucketCount: number): number {
  if (bucketCount <= 0) return 0;
  return Math.min(Math.max(index, 0), bucketCount - 1);
}

/** A new selection resets paging and returns an open signature-scope panel to the selected interval. */
function withSelection(state: InvestigationState, index: number): InvestigationState {
  if (index === state.selectedIndex) return state;
  return { ...state, selectedIndex: index, logPanel: { ...state.logPanel, visible: LOG_PAGE_SIZE, scope: 'bucket' } };
}

function withFilter(state: InvestigationState, signature: string | null): InvestigationState {
  if (signature === state.filter) return state;
  if (signature === null) {
    // Clearing the filter closes a signature-scope panel and leaves a bucket-scope panel open.
    const closes = state.logPanel.open && state.logPanel.scope === 'signature';
    return {
      ...state,
      filter: null,
      logPanel: { open: closes ? false : state.logPanel.open, visible: LOG_PAGE_SIZE, scope: 'bucket' },
    };
  }
  return { ...state, filter: signature, logPanel: { ...state.logPanel, visible: LOG_PAGE_SIZE } };
}

function openLogLines(state: InvestigationState, requested: LogScope): InvestigationState {
  // A signature scope only exists while a signature is selected.
  const scope: LogScope = requested === 'signature' && state.filter !== null ? 'signature' : 'bucket';
  if (state.logPanel.open && state.logPanel.scope === scope) return state;
  return { ...state, logPanel: { open: true, visible: LOG_PAGE_SIZE, scope } };
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
      return openLogLines(state, event.scope ?? 'bucket');
    case 'set-filter':
      return withFilter(state, event.signature);
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

/** Errors of one signature in one interval. `signatureCounts` is a plain object keyed by log-derived text, so inherited names such as `constructor` must read as absent. */
export function countForSignature(bucket: Pick<UtcBucket, 'signatureCounts'>, signature: string): number {
  return Object.hasOwn(bucket.signatureCounts, signature) ? (bucket.signatureCounts[signature] ?? 0) : 0;
}

const groupEventIds = new WeakMap<AnalysisStream, Map<string, ReadonlySet<string>>>();

/** Event ids of one error group, cached per stream; an unknown signature has none. */
function eventIdsForSignature(stream: AnalysisStream, signature: string): ReadonlySet<string> {
  let byStream = groupEventIds.get(stream);
  if (byStream === undefined) {
    byStream = new Map<string, ReadonlySet<string>>();
    for (const group of stream.errors) byStream.set(group.signature, new Set(group.eventIds));
    groupEventIds.set(stream, byStream);
  }
  return byStream.get(signature) ?? new Set<string>();
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
  const errors =
    state.filter === null
      ? plural(point.errorCount, 'error')
      : `${countForSignature(bucket, state.filter)} of ${plural(point.errorCount, 'error')}`;
  const parts = [
    formatUtcInterval(point.bucketStartUtc, point.bucketEndUtc),
    errors,
    plural(Object.keys(bucket.signatureCounts).length, 'signature'),
  ];
  if (insideOnsetWindow(point, stream.onset)) parts.push('Inside onset window');
  const commits = commitList(stream, point);
  if (commits.length > 0) parts.push(`Commits ${commits.join(', ')}`);
  const text = parts.join(SEPARATOR);
  const logCount = state.filter === null ? bucket.eventIds.length : countForSignature(bucket, state.filter);
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

function inTimeOrder(events: LogEvent[]): LogEvent[] {
  return events.sort((left, right) => compareText(left.timestampUtc, right.timestampUtc) || compareText(left.eventId, right.eventId));
}

/** The scope the panel actually shows: a signature scope without a filter falls back to the interval. */
function effectiveScope(state: InvestigationState): LogScope {
  return state.logPanel.scope === 'signature' && state.filter !== null ? 'signature' : 'bucket';
}

/**
 * Events for the log panel in time order (timestamp, then event id). Bucket scope is the selected interval,
 * intersected with the filter's events; signature scope is every event of the filtered signature.
 */
export function selectLogLines(stream: AnalysisStream, state: InvestigationState): LogEvent[] {
  const index = eventIndex(stream);
  const events: LogEvent[] = [];
  if (effectiveScope(state) === 'signature' && state.filter !== null) {
    const group = stream.errors.find((candidate) => candidate.signature === state.filter);
    for (const id of group?.eventIds ?? []) {
      const event = index.get(id);
      if (event !== undefined) events.push(event);
    }
    return inTimeOrder(events);
  }
  const bucket = stream.buckets[state.selectedIndex];
  if (bucket === undefined) return [];
  const allowed = state.filter === null ? null : eventIdsForSignature(stream, state.filter);
  for (const id of bucket.eventIds) {
    if (allowed !== null && !allowed.has(id)) continue;
    const event = index.get(id);
    if (event !== undefined) events.push(event);
  }
  return inTimeOrder(events);
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
  const count = plural(events.length, 'event');
  let heading = `Log lines${SEPARATOR}${interval}${SEPARATOR}${count}`;
  if (state.filter !== null) {
    heading =
      effectiveScope(state) === 'signature'
        ? `Log lines${SEPARATOR}${state.filter}${SEPARATOR}${count}`
        : `${heading}${SEPARATOR}${state.filter}`;
  }
  return {
    heading,
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

/** One row per interval (the first `tableVisible`), with the onset flag as text and commits as short hashes; Errors follows the filter. */
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
      errors: state.filter === null ? point.errorCount : countForSignature(bucket, state.filter),
      signatures: Object.keys(bucket.signatureCounts).length,
      onset: insideOnsetWindow(point, stream.onset) ? 'Yes' : NONE,
      commits: commits.length === 0 ? NONE : commits.join(', '),
    });
  }
  return { rows, total, hasMore: total > rows.length };
}

export interface SeriesView {
  /** Errors per interval across every signature. */
  totals: number[];
  /** Errors per interval for the filtered signature, or null when unfiltered. */
  filtered: number[] | null;
  /** From the totals only (at least 1), so filtering never rescales the y-axis. */
  yMax: number;
}

export function buildSeries(stream: AnalysisStream, filter: string | null): SeriesView {
  const totals = stream.timeline.map((point) => point.errorCount);
  const filtered = filter === null ? null : stream.buckets.map((bucket) => countForSignature(bucket, filter));
  return { totals, filtered, yMax: totals.reduce((max, value) => Math.max(max, value), 1) };
}

export const NO_ERRORS_TEXT = 'No errors in this log';

export interface SignatureRow {
  signature: string;
  representativeMessage: string;
  count: number;
  /** `HH:MM:SS` (UTC). */
  firstSeen: string;
  /** `YYYY-MM-DD HH:MM:SS UTC`. */
  firstSeenTitle: string;
  /** Row name for assistive tech; carries the full date only when it differs from the onset day. */
  accessibleName: string;
  pressed: boolean;
  actionLabel: 'Filter timeline' | 'Filtering — clear';
}

export interface SignatureTableView {
  rows: SignatureRow[];
  emptyText: string | null;
}

function referenceDate(stream: AnalysisStream): string | null {
  const start = stream.onset.windowStartUtc ?? stream.buckets[0]?.bucketStartUtc ?? null;
  return start === null ? null : start.slice(0, 10);
}

function compareGroups(left: ErrorGroup, right: ErrorGroup): number {
  return right.count - left.count || compareText(left.firstSeenUtc, right.firstSeenUtc) || compareText(left.signature, right.signature);
}

/** Every signature, events descending then first seen then signature; one active signature at a time. */
export function buildSignatureRows(stream: AnalysisStream, state: Pick<InvestigationState, 'filter'>): SignatureTableView {
  if (stream.errors.length === 0) return { rows: [], emptyText: NO_ERRORS_TEXT };
  const reference = referenceDate(stream);
  const rows = [...stream.errors].sort(compareGroups).map((group): SignatureRow => {
    const firstSeen = formatUtcSeconds(group.firstSeenUtc);
    const firstSeenTitle = formatUtcDateSeconds(group.firstSeenUtc);
    const differentDay = reference === null || group.firstSeenUtc.slice(0, 10) !== reference;
    const when = differentDay ? firstSeenTitle : `${firstSeen} UTC`;
    const pressed = state.filter === group.signature;
    return {
      signature: group.signature,
      representativeMessage: group.representativeMessage,
      count: group.count,
      firstSeen,
      firstSeenTitle,
      accessibleName: `${group.signature}, ${plural(group.count, 'event')}, first seen ${when}`,
      pressed,
      actionLabel: pressed ? 'Filtering — clear' : 'Filter timeline',
    };
  });
  return { rows, emptyText: null };
}
