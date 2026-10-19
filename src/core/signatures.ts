import type { ErrorGroup, LogEvent, StackFrame } from './model';
import { canonicalWhitespace } from './normalization';

const UUID_PATTERN = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi;
const LONG_HEX_PATTERN = /\b[0-9a-f]{8,}\b/gi;
const REQUEST_IDENTIFIER_PATTERN = /(\b(?:request|req|trace|span)(?:[-_ ]?id)?\s*[:=]\s*)[A-Za-z0-9_-]{6,}/gi;
const GENERIC_IDENTIFIER_PATTERN = /\b(?=[A-Za-z0-9_-]{12,}\b)(?=[A-Za-z0-9_-]*[A-Za-z])(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]+\b/g;
const NUMBER_PATTERN = /\b\d+(?:\.\d+)?\b/g;
const QUOTED_VALUE_PATTERN = /"[^"\n]*"|'[^'\n]*'|`[^`\n]*`/g;

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareEvents(left: LogEvent, right: LogEvent): number {
  const leftEpoch = Date.parse(left.timestampUtc);
  const rightEpoch = Date.parse(right.timestampUtc);
  return leftEpoch - rightEpoch || compareText(left.eventId, right.eventId);
}

function frameKey(frame: StackFrame): string {
  return [
    frame.filePath ?? '',
    frame.functionName ?? '',
    frame.line ?? '',
    frame.column ?? '',
    frame.vendor ? '1' : '0',
  ].join('|');
}

function firstApplicationFrame(event: LogEvent): StackFrame | null {
  return event.stackFrames.find((frame) => frame.filePath !== null && !frame.vendor) ?? null;
}

/**
 * Replace only high-cardinality values while retaining the words that explain
 * the operation. Replacement order is intentional and locale independent.
 */
export function normalizeErrorMessage(message: string): string {
  let normalized = canonicalWhitespace(message)
    .replace(UUID_PATTERN, '<uuid>')
    .replace(LONG_HEX_PATTERN, '<id>')
    .replace(REQUEST_IDENTIFIER_PATTERN, '$1<id>')
    .replace(GENERIC_IDENTIFIER_PATTERN, '<id>')
    .replace(NUMBER_PATTERN, '<number>')
    .replace(QUOTED_VALUE_PATTERN, '<value>');
  return canonicalWhitespace(normalized);
}

/** Return the exact stable grouping key for one normalized error event. */
export function signatureForEvent(event: LogEvent): string {
  const exception = canonicalWhitespace(event.exception ?? '') || '<no-exception>';
  const normalizedMessage = normalizeErrorMessage(event.message);
  const frame = firstApplicationFrame(event);
  const applicationEvidence = frame === null
    ? '<no-application-frame>'
    : `${frame.filePath ?? '<unknown>'}${frame.functionName === null ? '' : `#${frame.functionName}`}`;
  return `${exception} | ${normalizedMessage} | ${applicationEvidence}`;
}

function sortedUnique(values: string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function mergeFrames(events: LogEvent[]): StackFrame[] {
  const frames = new Map<string, StackFrame>();
  for (const event of events) {
    for (const frame of event.stackFrames) {
      const key = frameKey(frame);
      if (!frames.has(key)) frames.set(key, frame);
    }
  }
  return [...frames.values()].sort((left, right) => {
    const ownership = Number(left.vendor) - Number(right.vendor);
    return ownership || compareText(frameKey(left), frameKey(right));
  });
}

/**
 * Group error/fatal events by their complete normalized signature. Every
 * returned group retains raw message variants, source event IDs, timestamps,
 * all parsed frames, and a warning when ownership evidence is unavailable.
 */
export function groupErrorEvents(events: LogEvent[]): ErrorGroup[] {
  const groups = new Map<string, LogEvent[]>();
  for (const event of [...events].sort(compareEvents)) {
    if (event.level !== 'error' && event.level !== 'fatal') continue;
    const signature = signatureForEvent(event);
    const members = groups.get(signature);
    if (members === undefined) groups.set(signature, [event]);
    else members.push(event);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([signature, members]) => {
      const first = members[0];
      const last = members.at(-1);
      if (first === undefined || last === undefined) throw new Error('Error group cannot be empty.');
      const hasApplicationFrame = members.some((event) => firstApplicationFrame(event) !== null);
      const warning = 'No meaningful application-owned stack frame was parsed for this error group.';
      const warnings = hasApplicationFrame ? [] : [warning];
      return {
        signature,
        representativeMessage: first.rawMessage,
        count: members.length,
        firstSeenUtc: first.timestampUtc,
        lastSeenUtc: last.timestampUtc,
        eventIds: members.map((event) => event.eventId).sort(compareText),
        stackFrames: mergeFrames(members),
        rawMessages: sortedUnique(members.map((event) => event.rawMessage)),
        warnings,
        diagnostics: [...warnings],
      };
    });
}
