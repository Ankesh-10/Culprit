import type {
  ChangedLineRange,
  ErrorGroup,
  LogEvent,
  StackFrame,
  TimestampUtc,
  TraceMatchKind,
} from './model';
import { compareText } from './normalization';

/** Who owns the code a stack frame points at. Only `application` frames can earn trace credit. */
export type FrameOwnership = 'application' | 'vendor' | 'build-output' | 'runtime' | 'unattributed';

const RUNTIME_SCHEME = /^[a-z0-9+.-]+:\/\//i;
const VENDOR_SEGMENTS: ReadonlySet<string> = new Set(['node_modules', 'vendor', 'third_party', 'site-packages', 'bower_components']);
const BUILD_ROOT_SEGMENTS: ReadonlySet<string> = new Set(['dist', 'build', 'out', 'coverage', '.next']);
const BUILD_SEGMENTS: ReadonlySet<string> = new Set(['generated', '__generated__']);
const BUILD_SUFFIXES: readonly string[] = ['.min.js', '.bundle.js', '.map', '.d.ts'];

/**
 * Classify a normalized repository path. Rule order: runtime, vendor, build-output, application.
 * Shared by stack frames and changed files so both sides agree on what counts as owned code.
 */
export function classifyPath(path: string): Exclude<FrameOwnership, 'unattributed'> {
  if (
    path.startsWith('node:') ||
    path.startsWith('internal/') ||
    path.includes('<anonymous>') ||
    path === 'native' ||
    RUNTIME_SCHEME.test(path)
  ) {
    return 'runtime';
  }
  const segments = path.split('/');
  if (segments.some((segment) => VENDOR_SEGMENTS.has(segment))) return 'vendor';
  const first = segments[0] ?? '';
  const basename = segments.at(-1) ?? '';
  if (
    BUILD_ROOT_SEGMENTS.has(first) ||
    segments.some((segment) => BUILD_SEGMENTS.has(segment)) ||
    BUILD_SUFFIXES.some((suffix) => basename.endsWith(suffix))
  ) {
    return 'build-output';
  }
  return 'application';
}

/** Null paths are unattributed, the parser vendor flag wins, otherwise the path decides. */
export function classifyFrame(frame: StackFrame): FrameOwnership {
  if (frame.filePath === null) return 'unattributed';
  if (frame.vendor) return 'vendor';
  return classifyPath(frame.filePath);
}

/**
 * The first application-owned frame of one event, walking the event's own frames in their
 * original order. `ErrorGroup.stackFrames` is re-sorted by the signature module and must not be
 * used for this.
 */
export function topApplicationFrame(event: LogEvent): StackFrame | null {
  for (const frame of event.stackFrames) {
    if (classifyFrame(frame) === 'application') return frame;
  }
  return null;
}

export type PathMatch =
  | { kind: 'exact' | 'prefix-stripped'; path: string }
  | { kind: 'ambiguous'; paths: string[] }
  | { kind: 'none' };

function segmentCount(path: string): number {
  return path.split('/').length;
}

/**
 * Match a stack-frame path to the changed paths of one commit without inventing evidence.
 * Exact equality wins. Otherwise a suffix match is allowed only on a '/' boundary and only when the
 * shorter path has at least two segments; more than one candidate is ambiguous and earns no credit.
 * Same-directory siblings and basename-only matches never count.
 */
export function matchPath(framePath: string, changedPaths: readonly string[]): PathMatch {
  if (changedPaths.includes(framePath)) return { kind: 'exact', path: framePath };
  const candidates = [...new Set(changedPaths.filter((changed) =>
    (segmentCount(changed) >= 2 && framePath.endsWith('/' + changed)) ||
    (segmentCount(framePath) >= 2 && changed.endsWith('/' + framePath))))].sort(compareText);
  const only = candidates[0];
  if (candidates.length === 1 && only !== undefined) return { kind: 'prefix-stripped', path: only };
  if (candidates.length > 1) return { kind: 'ambiguous', paths: candidates };
  return { kind: 'none' };
}

export interface LineMatch {
  kind: TraceMatchKind;
  range: ChangedLineRange | null;
}

function rangeDistance(line: number, range: ChangedLineRange): number {
  return line < range.start ? range.start - line : line - range.end;
}

/** Inclusive range semantics; a missing line number can only ever be a file-level match. */
export function classifyLine(line: number | null, ranges: readonly ChangedLineRange[], nearbyLines: number): LineMatch {
  if (line === null) return { kind: 'file-only', range: null };
  let nearest: ChangedLineRange | null = null;
  let nearestDistance = 0;
  for (const range of ranges) {
    if (line >= range.start && line <= range.end) return { kind: 'exact-line', range };
    const distance = rangeDistance(line, range);
    const closer = nearest === null
      || distance < nearestDistance
      || (distance === nearestDistance && (range.start < nearest.start || (range.start === nearest.start && range.end < nearest.end)));
    if (closer) {
      nearest = range;
      nearestDistance = distance;
    }
  }
  if (nearest !== null && nearestDistance <= nearbyLines) return { kind: 'nearby-line', range: nearest };
  return { kind: 'file-only', range: null };
}

/** Index of the first entry that is >= epoch in an ascending array (lower bound). */
export function lowerBound(sortedEpochs: readonly number[], epoch: number): number {
  let low = 0;
  let high = sortedEpochs.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if ((sortedEpochs[middle] ?? Infinity) < epoch) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** How many entries of an ascending array are at or after the epoch (inclusive). */
export function countAtOrAfter(sortedEpochs: readonly number[], epoch: number): number {
  return sortedEpochs.length - lowerBound(sortedEpochs, epoch);
}

export interface IndexedFrameEvent {
  eventId: string;
  epoch: number;
  timestampUtc: TimestampUtc;
  signature: string;
}

export interface IndexedFrameSignature {
  signature: string;
  epochs: number[];
}

export interface IndexedFrame {
  path: string;
  line: number | null;
  events: IndexedFrameEvent[];
  epochs: number[];
  /** The same epochs split by error signature, for per-group evidence without rescanning events. */
  signatures: IndexedFrameSignature[];
}

export interface IndexedGroup {
  signature: string;
  firstSeenUtc: TimestampUtc;
  firstSeenEpoch: number;
  count: number;
}

export interface EvidenceIndex {
  totalErrorEvents: number;
  applicationFrameEvents: number;
  frames: IndexedFrame[];
  groups: IndexedGroup[];
}

function compareIndexedEvents(left: IndexedFrameEvent, right: IndexedFrameEvent): number {
  return left.epoch - right.epoch || compareText(left.eventId, right.eventId);
}

function compareFrames(left: IndexedFrame, right: IndexedFrame): number {
  const byPath = compareText(left.path, right.path);
  if (byPath !== 0) return byPath;
  if (left.line === right.line) return 0;
  if (left.line === null) return -1;
  if (right.line === null) return 1;
  return left.line - right.line;
}

function splitBySignature(events: readonly IndexedFrameEvent[]): IndexedFrameSignature[] {
  const bySignature = new Map<string, number[]>();
  for (const event of events) {
    const epochs = bySignature.get(event.signature);
    if (epochs === undefined) bySignature.set(event.signature, [event.epoch]);
    else epochs.push(event.epoch);
  }
  return [...bySignature.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([signature, epochs]) => ({ signature, epochs }));
}

/**
 * Aggregate every error event once into its distinct top application frame so that scoring a
 * commit costs distinct frames times changed files, never commits times events.
 */
export function buildEvidenceIndex(events: readonly LogEvent[], groups: readonly ErrorGroup[]): EvidenceIndex {
  const signatureByEvent = new Map<string, string>();
  for (const group of groups) {
    for (const eventId of group.eventIds) signatureByEvent.set(eventId, group.signature);
  }

  let totalErrorEvents = 0;
  let applicationFrameEvents = 0;
  const aggregated = new Map<string, { path: string; line: number | null; events: IndexedFrameEvent[] }>();
  for (const event of events) {
    if (event.level !== 'error' && event.level !== 'fatal') continue;
    const signature = signatureByEvent.get(event.eventId);
    if (signature === undefined) continue;
    totalErrorEvents += 1;
    const frame = topApplicationFrame(event);
    if (frame === null || frame.filePath === null) continue;
    applicationFrameEvents += 1;
    const key = JSON.stringify([frame.filePath, frame.line]);
    const entry: IndexedFrameEvent = {
      eventId: event.eventId,
      epoch: Date.parse(event.timestampUtc),
      timestampUtc: event.timestampUtc,
      signature,
    };
    const existing = aggregated.get(key);
    if (existing === undefined) aggregated.set(key, { path: frame.filePath, line: frame.line, events: [entry] });
    else existing.events.push(entry);
  }

  const frames: IndexedFrame[] = [...aggregated.values()].map((frame) => {
    const sorted = [...frame.events].sort(compareIndexedEvents);
    return {
      path: frame.path,
      line: frame.line,
      events: sorted,
      epochs: sorted.map((entry) => entry.epoch),
      signatures: splitBySignature(sorted),
    };
  }).sort(compareFrames);

  const indexedGroups: IndexedGroup[] = groups
    .map((group) => ({
      signature: group.signature,
      firstSeenUtc: group.firstSeenUtc,
      firstSeenEpoch: Date.parse(group.firstSeenUtc),
      count: group.count,
    }))
    .sort((left, right) => compareText(left.signature, right.signature));

  return { totalErrorEvents, applicationFrameEvents, frames, groups: indexedGroups };
}
