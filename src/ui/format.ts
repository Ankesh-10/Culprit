import type { TraceMatchKind } from '../core/model';

/**
 * Deterministic display formatting. Times are sliced from normalized ISO strings so the output never
 * depends on the viewer's time zone or locale; nothing here constructs a date object.
 */

const UTC_ISO = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?Z$/;
const EN_DASH = '–';

interface UtcParts {
  date: string;
  hours: string;
  minutes: string;
  seconds: string;
}

function parseUtc(iso: string): UtcParts | null {
  const match = UTC_ISO.exec(iso);
  if (match === null) return null;
  const [, date, hours, minutes, seconds] = match;
  if (date === undefined || hours === undefined || minutes === undefined || seconds === undefined) return null;
  return { date, hours, minutes, seconds };
}

/** `04:18 UTC`; non-ISO input is returned unchanged. */
export function formatUtcClock(iso: string): string {
  const parts = parseUtc(iso);
  return parts === null ? iso : `${parts.hours}:${parts.minutes} UTC`;
}

/** `2026-10-19 04:18 UTC`; non-ISO input is returned unchanged. */
export function formatUtcDateTime(iso: string): string {
  const parts = parseUtc(iso);
  return parts === null ? iso : `${parts.date} ${parts.hours}:${parts.minutes} UTC`;
}

/** `04:20:30` (no suffix, for columns already labelled UTC); non-ISO input is returned unchanged. */
export function formatUtcSeconds(iso: string): string {
  const parts = parseUtc(iso);
  return parts === null ? iso : `${parts.hours}:${parts.minutes}:${parts.seconds}`;
}

/** `2026-10-19 04:20:30 UTC`; non-ISO input is returned unchanged. */
export function formatUtcDateSeconds(iso: string): string {
  const parts = parseUtc(iso);
  return parts === null ? iso : `${parts.date} ${parts.hours}:${parts.minutes}:${parts.seconds} UTC`;
}

/** `04:30–04:35 UTC`; when either end is not ISO both inputs are returned unchanged. */
export function formatUtcInterval(startIso: string, endIso: string): string {
  const start = parseUtc(startIso);
  const end = parseUtc(endIso);
  if (start === null || end === null) return `${startIso}${EN_DASH}${endIso}`;
  return `${start.hours}:${start.minutes}${EN_DASH}${end.hours}:${end.minutes} UTC`;
}

/** `12 min`, `1 h 5 min`, `1 h`, `under 1 min`. */
export function formatDuration(minutes: number): string {
  if (minutes > 0 && minutes < 0.5) return 'under 1 min';
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

export function formatTimeGap(minutes: number): string {
  return minutes <= 0 ? 'At the onset window start' : `${formatDuration(minutes)} before onset window start`;
}

export function formatGapShort(minutes: number): string {
  return minutes <= 0 ? 'At onset' : `${formatDuration(minutes)} before onset`;
}

export function formatScore(score: number, digits: number): string {
  return score.toFixed(digits);
}

export function plural(count: number, singular: string, pluralForm: string = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

/** Stub (RED): replaced by the grouped implementation. */
export function formatInteger(n: number): string {
  return String(n);
}

export function formatMiB(bytes: number): string {
  return `${(bytes / 1048576).toFixed(1)} MiB`;
}

export function formatLineRange(start: number, end: number): string {
  return start === end ? `L${start}` : `L${start}${EN_DASH}${end}`;
}

export function formatPathRange(path: string, start: number | null, end: number | null): string {
  if (start === null) return path;
  if (end === null || end === start) return `${path}:${start}`;
  return `${path}:${start}${EN_DASH}${end}`;
}

export function formatCompactCount(count: number): string {
  return count < 1000 ? String(count) : `${Math.round(count / 100) / 10}K`;
}

const TRACE_LABELS: Record<TraceMatchKind, string> = {
  'exact-line': 'Exact line',
  'nearby-line': 'Nearby line',
  'file-only': 'File only',
  none: 'No trace match',
};

export function traceMatchLabel(kind: TraceMatchKind): string {
  return TRACE_LABELS[kind];
}
