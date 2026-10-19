import type { LogEvent, LogFormat, LogLevel, LogSourceRef, ParsedLogDocument, StackFrame } from './model';
import {
  EmptyInputError,
  InputLimitError,
  MalformedInputError,
  type InputDiagnostic,
  type InputErrorCode,
  type InputErrorDetails,
  UnsupportedFormatError,
} from './input-errors';
import type { ParseOutcome } from './input-errors';
import { canonicalWhitespace, normalizeRepositoryPath, normalizeTimestampUtc, stableSourceId } from './normalization';

export const DEFAULT_LOG_LIMITS = {
  maxLogBytes: 1_048_576,
  maxEvents: 10_000,
  maxStackLines: 100,
} as const;

export interface LogParserOptions {
  source?: string;
  maxLogBytes?: number;
  maxEvents?: number;
  maxStackLines?: number;
}

const LOG_LEVELS = new Set<LogLevel>(['trace', 'debug', 'info', 'warn', 'error', 'fatal']);
const JSON_FIELDS = new Set(['timestamp', 'level', 'message', 'error', 'exception', 'stack']);
const PREFIX_PATTERN = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))\s+(trace|debug|info|warn|error|fatal)\s+(\S.*)$/;
const TIMESTAMP_LIKE = /^\s*\d{4}-\d{2}-\d{2}T/;

interface EventDraft {
  timestampUtc: string;
  level: LogLevel;
  message: string;
  rawMessage: string;
  exception: string | null;
  stackLines: string[];
  source: LogSourceRef;
  rawLine: string;
}

function optionsWithDefaults(options: LogParserOptions | undefined) {
  return {
    source: options?.source ?? 'logs',
    maxLogBytes: options?.maxLogBytes ?? DEFAULT_LOG_LIMITS.maxLogBytes,
    maxEvents: options?.maxEvents ?? DEFAULT_LOG_LIMITS.maxEvents,
    maxStackLines: options?.maxStackLines ?? DEFAULT_LOG_LIMITS.maxStackLines,
  };
}

function diagnostic(code: InputErrorCode, message: string, details: InputErrorDetails = {}): InputDiagnostic {
  return {
    source: details.source ?? 'logs',
    code,
    message,
    line: details.line ?? null,
    record: details.record ?? null,
    field: details.field ?? null,
    raw: details.raw ?? null,
  };
}

function normalizeLines(text: string): string[] {
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const lines = withoutBom.replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
}

function inputBytes(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

function parseFrame(line: string): StackFrame | null {
  const match = /^\s*at\s+(?:(async)\s+)?(.+?)\s+\(([^():]+|[^()]+):([1-9]\d*):([1-9]\d*)\)\s*$/.exec(line)
    ?? /^\s*at\s+(?:(async)\s+)?([^():]+|[^()]+):([1-9]\d*):([1-9]\d*)\s*$/.exec(line);
  if (match === null) return null;
  const isParenthesized = match.length === 6;
  const functionName = isParenthesized ? (match[2] ?? null) : null;
  const path = isParenthesized ? match[3] : match[2];
  const lineNumber = isParenthesized ? match[4] : match[3];
  const columnNumber = isParenthesized ? match[5] : match[4];
  if (path === undefined || lineNumber === undefined || columnNumber === undefined) return null;
  let filePath: string | null = path.trim();
  try {
    filePath = normalizeRepositoryPath(filePath);
  } catch {
    filePath = null;
  }
  return {
    filePath,
    line: Number(lineNumber),
    column: Number(columnNumber),
    functionName: functionName === null ? null : canonicalWhitespace(functionName),
    vendor: filePath !== null && (filePath.includes('node_modules/') || filePath.includes('/vendor/') || filePath.startsWith('vendor/')),
  };
}

function framesFor(stackLines: string[]): StackFrame[] {
  return stackLines.map(parseFrame).filter((frame): frame is StackFrame => frame !== null);
}

function eventBaseId(draft: EventDraft): string {
  return stableSourceId(draft.timestampUtc, draft.level, draft.message, draft.exception, draft.stackLines);
}

function finalizeEvents(drafts: EventDraft[]): LogEvent[] {
  const ordinals = new Map<string, number>();
  return drafts.map((draft) => {
    const baseId = eventBaseId(draft);
    const ordinal = (ordinals.get(baseId) ?? 0) + 1;
    ordinals.set(baseId, ordinal);
    const stack = draft.stackLines.length === 0 ? null : draft.stackLines.join('\n');
    return {
      eventId: `${baseId}-${ordinal}`,
      timestampUtc: draft.timestampUtc,
      level: draft.level,
      message: draft.message,
      rawMessage: draft.rawMessage,
      exception: draft.exception,
      stack,
      stackFrames: framesFor(draft.stackLines),
      source: draft.source,
      rawLine: draft.rawLine,
    };
  }).sort((left, right) => left.timestampUtc < right.timestampUtc ? -1 : left.timestampUtc > right.timestampUtc ? 1 : left.eventId < right.eventId ? -1 : left.eventId > right.eventId ? 1 : 0);
}

function emptyFailure<T>(error: EmptyInputError): ParseOutcome<T> {
  return { ok: false, error, diagnostics: [error.toDiagnostic()] };
}

function limitFailure<T>(error: InputLimitError, diagnostics: InputDiagnostic[] = []): ParseOutcome<T> {
  return { ok: false, error, diagnostics: [...diagnostics, error.toDiagnostic()] };
}

function checkInput<T>(text: string, options: ReturnType<typeof optionsWithDefaults>): ParseOutcome<T> | null {
  const bytes = inputBytes(text);
  if (bytes > options.maxLogBytes) {
    const error = new InputLimitError(`Log input is ${bytes} UTF-8 bytes; the limit is ${options.maxLogBytes}.`, { source: options.source });
    return limitFailure(error);
  }
  if (text.trim().length === 0) {
    return emptyFailure(new EmptyInputError({ source: options.source }));
  }
  return null;
}

function document(format: LogFormat, source: string, events: LogEvent[], diagnostics: InputDiagnostic[]): ParsedLogDocument {
  return { format, source, events, diagnostics };
}

export function parseJsonLinesLog(text: string, parserOptions?: LogParserOptions): ParseOutcome<ParsedLogDocument> {
  const options = optionsWithDefaults(parserOptions);
  const early = checkInput<ParsedLogDocument>(text, options);
  if (early !== null) return early;
  const lines = normalizeLines(text);
  const diagnostics: InputDiagnostic[] = [];
  const drafts: EventDraft[] = [];
  let record = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? '';
    if (rawLine.trim() === '') continue;
    record += 1;
    let value: unknown;
    try {
      value = JSON.parse(rawLine) as unknown;
    } catch {
      diagnostics.push(diagnostic('MALFORMED_RECORD', 'JSON-lines record is not valid JSON.', { source: options.source, line: index + 1, record, raw: rawLine }));
      continue;
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      diagnostics.push(diagnostic('MALFORMED_RECORD', 'JSON-lines record must be an object.', { source: options.source, line: index + 1, record, raw: rawLine }));
      continue;
    }
    const object = value as Record<string, unknown>;
    const unknownField = Object.keys(object).find((field) => !JSON_FIELDS.has(field));
    if (unknownField !== undefined) {
      diagnostics.push(diagnostic('INVALID_FIELD', `Unsupported log field "${unknownField}".`, { source: options.source, line: index + 1, record, field: unknownField, raw: rawLine }));
      continue;
    }
    const timestamp = object.timestamp;
    if (typeof timestamp !== 'string') {
      diagnostics.push(diagnostic('MALFORMED_RECORD', 'Log record requires a string timestamp.', { source: options.source, line: index + 1, record, field: 'timestamp', raw: rawLine }));
      continue;
    }
    let timestampUtc: string;
    try {
      timestampUtc = normalizeTimestampUtc(timestamp);
    } catch {
      diagnostics.push(diagnostic('INVALID_TIMESTAMP', 'Timestamp must be a valid ISO-8601 value with Z or a numeric offset.', { source: options.source, line: index + 1, record, field: 'timestamp', raw: rawLine }));
      continue;
    }
    const messageValue = object.message ?? object.error;
    if (typeof messageValue !== 'string' || canonicalWhitespace(messageValue).length === 0) {
      diagnostics.push(diagnostic('MALFORMED_RECORD', 'Log record requires a non-empty string message or error.', { source: options.source, line: index + 1, record, field: 'message', raw: rawLine }));
      continue;
    }
    const levelValue = object.level ?? 'info';
    if (typeof levelValue !== 'string' || !LOG_LEVELS.has(levelValue as LogLevel)) {
      diagnostics.push(diagnostic('INVALID_FIELD', 'Log level must be one of trace, debug, info, warn, error, or fatal.', { source: options.source, line: index + 1, record, field: 'level', raw: rawLine }));
      continue;
    }
    if (object.exception !== undefined && typeof object.exception !== 'string') {
      diagnostics.push(diagnostic('INVALID_FIELD', 'Exception must be a string when present.', { source: options.source, line: index + 1, record, field: 'exception', raw: rawLine }));
      continue;
    }
    if (object.stack !== undefined && typeof object.stack !== 'string') {
      diagnostics.push(diagnostic('INVALID_FIELD', 'Stack must be a string when present.', { source: options.source, line: index + 1, record, field: 'stack', raw: rawLine }));
      continue;
    }
    const stackLines = typeof object.stack === 'string' && object.stack.length > 0 ? object.stack.replaceAll('\r\n', '\n').replaceAll('\r', '\n').split('\n') : [];
    if (stackLines.length > options.maxStackLines) {
      const error = new InputLimitError(`Record ${record} contains ${stackLines.length} stack lines; the limit is ${options.maxStackLines}.`, { source: options.source, line: index + 1, record, field: 'stack', raw: rawLine });
      return limitFailure(error, [...diagnostics, diagnostic('STACK_ATTACHMENT', 'Stack line limit exceeded; the record was not truncated.', { source: options.source, line: index + 1, record, field: 'stack', raw: rawLine })]);
    }
    if (drafts.length >= options.maxEvents) {
      const error = new InputLimitError(`Log input exceeds the ${options.maxEvents}-event limit.`, { source: options.source, line: index + 1, record, raw: rawLine });
      return limitFailure(error, diagnostics);
    }
    drafts.push({
      timestampUtc,
      level: levelValue as LogLevel,
      message: canonicalWhitespace(messageValue),
      rawMessage: messageValue,
      exception: typeof object.exception === 'string' ? canonicalWhitespace(object.exception) : null,
      stackLines,
      source: { source: options.source, line: index + 1, record },
      rawLine,
    });
  }
  if (drafts.length === 0) {
    const error = new MalformedInputError('No valid JSON-lines records were found.', { source: options.source });
    return { ok: false, error, diagnostics: [...diagnostics, error.toDiagnostic()] };
  }
  return { ok: true, value: document('jsonl', options.source, finalizeEvents(drafts), diagnostics), diagnostics };
}

function isContinuation(line: string): boolean {
  return /^\s+/.test(line) || /^\s*at\b/.test(line) || /^\s*Caused by:/.test(line);
}

function appendContinuation(draft: EventDraft, line: string, lineNumber: number, options: ReturnType<typeof optionsWithDefaults>, diagnostics: InputDiagnostic[]): boolean {
  if (draft.stackLines.length >= options.maxStackLines) {
    diagnostics.push(diagnostic('STACK_ATTACHMENT', `Stack continuation exceeds the ${options.maxStackLines}-line limit.`, { source: options.source, line: lineNumber, record: draft.source.record, raw: line }));
    return false;
  }
  draft.stackLines.push(line);
  return true;
}

export function parsePlainTextLog(text: string, parserOptions?: LogParserOptions): ParseOutcome<ParsedLogDocument> {
  const options = optionsWithDefaults(parserOptions);
  const early = checkInput<ParsedLogDocument>(text, options);
  if (early !== null) return early;
  const lines = normalizeLines(text);
  const diagnostics: InputDiagnostic[] = [];
  const drafts: EventDraft[] = [];
  let current: EventDraft | null = null;
  let record = 0;
  let stackLimitExceeded = false;
  for (let index = 0; index < lines.length; index += 1) {
    const rawLine = lines[index] ?? '';
    if (rawLine.trim() === '') continue;
    const prefix = PREFIX_PATTERN.exec(rawLine);
    if (prefix !== null) {
      if (drafts.length >= options.maxEvents) {
        const error = new InputLimitError(`Log input exceeds the ${options.maxEvents}-event limit.`, { source: options.source, line: index + 1, raw: rawLine });
        return limitFailure(error, diagnostics);
      }
      record += 1;
      let timestampUtc: string;
      try {
        timestampUtc = normalizeTimestampUtc(prefix[1] ?? '');
      } catch {
        diagnostics.push(diagnostic('INVALID_TIMESTAMP', 'Timestamp must be a valid ISO-8601 value with Z or a numeric offset.', { source: options.source, line: index + 1, record, field: 'timestamp', raw: rawLine }));
        current = null;
        continue;
      }
      current = {
        timestampUtc,
        level: (prefix[2] ?? 'info') as LogLevel,
        message: canonicalWhitespace(prefix[3] ?? ''),
        rawMessage: prefix[3] ?? '',
        exception: null,
        stackLines: [],
        source: { source: options.source, line: index + 1, record },
        rawLine,
      };
      drafts.push(current);
      continue;
    }
    if (TIMESTAMP_LIKE.test(rawLine)) {
      diagnostics.push(diagnostic('STACK_ATTACHMENT', 'Timestamp-like line does not match the supported timestamp/level prefix and was not attached.', { source: options.source, line: index + 1, record: current?.source.record ?? null, raw: rawLine }));
      continue;
    }
    if (current !== null && isContinuation(rawLine)) {
      if (!appendContinuation(current, rawLine, index + 1, options, diagnostics)) stackLimitExceeded = true;
      continue;
    }
    diagnostics.push(diagnostic('STACK_ATTACHMENT', current === null ? 'Continuation line has no preceding log event.' : 'Line is not an unambiguous supported stack continuation.', { source: options.source, line: index + 1, record: current?.source.record ?? null, raw: rawLine }));
  }
  if (drafts.length === 0) {
    const error = new MalformedInputError('No valid plain-text log entries were found.', { source: options.source });
    return { ok: false, error, diagnostics: [...diagnostics, error.toDiagnostic()] };
  }
  if (stackLimitExceeded) {
    const error = new InputLimitError(`A plain-text stack exceeded the ${options.maxStackLines}-line limit.`, { source: options.source });
    return limitFailure(error, diagnostics);
  }
  const events = finalizeEvents(drafts);
  return { ok: true, value: document('plain-text', options.source, events, diagnostics), diagnostics };
}

export function parseLog(text: string, format: LogFormat, options?: LogParserOptions): ParseOutcome<ParsedLogDocument> {
  if (format === 'jsonl') return parseJsonLinesLog(text, options);
  if (format === 'plain-text') return parsePlainTextLog(text, options);
  const source = options?.source ?? 'logs';
  const error = new UnsupportedFormatError(`Unsupported log format "${String(format)}".`, { source });
  return { ok: false, error, diagnostics: [error.toDiagnostic()] };
}
