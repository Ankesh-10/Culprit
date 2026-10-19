import type { ChangedFile, ChangedLineRange, GitCommit, GitHistoryDocument, LogSourceRef } from './model';
import {
  EmptyInputError,
  HistoryValidationError,
  MalformedInputError,
  type InputDiagnostic,
  type InputErrorDetails,
} from './input-errors';
import type { ParseOutcome } from './input-errors';
import { canonicalWhitespace, normalizeRepositoryPath, normalizeTimestampUtc } from './normalization';

export interface HistoryParserOptions {
  source?: string;
}

type JsonRecord = Record<string, unknown>;

function diagnostic(message: string, details: InputErrorDetails = {}): InputDiagnostic {
  return {
    source: details.source ?? 'history',
    code: 'HISTORY_VALIDATION',
    message,
    line: details.line ?? null,
    record: details.record ?? null,
    field: details.field ?? null,
    raw: details.raw ?? null,
  };
}

function failure(error: HistoryValidationError | MalformedInputError | EmptyInputError, diagnostics: InputDiagnostic[] = []): ParseOutcome<GitHistoryDocument> {
  return { ok: false, error, diagnostics: [...diagnostics, error.toDiagnostic()] };
}

function record(value: unknown, label: string, details: InputErrorDetails): JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new HistoryValidationError(`${label} must be an object.`, { ...details, field: label });
  }
  return value as JsonRecord;
}

function requiredString(object: JsonRecord, field: string, details: InputErrorDetails, nonEmpty = true): string {
  const value = object[field];
  if (typeof value !== 'string' || (nonEmpty && canonicalWhitespace(value).length === 0)) {
    throw new HistoryValidationError(`${field} must be a non-empty string.`, { ...details, field });
  }
  return value;
}

function stringArray(value: unknown, details: InputErrorDetails, field: string): unknown[] {
  if (!Array.isArray(value)) throw new HistoryValidationError(`${field} must be an array.`, { ...details, field });
  return value;
}

function integer(value: unknown, field: string, details: InputErrorDetails, minimum: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || !Number.isFinite(value) || value < minimum) {
    throw new HistoryValidationError(`${field} must be a finite integer >= ${minimum}.`, { ...details, field });
  }
  return value;
}

function sameFile(left: ChangedFile, right: ChangedFile): boolean {
  return left.path === right.path && left.added === right.added && left.deleted === right.deleted && JSON.stringify(left.ranges) === JSON.stringify(right.ranges);
}

function parseFile(value: unknown, source: string, commitRecord: number, fileIndex: number): ChangedFile {
  const details = { source, record: commitRecord };
  const object = record(value, `files[${fileIndex}]`, details);
  const pathValue = requiredString(object, 'path', details);
  let path: string;
  try {
    path = normalizeRepositoryPath(pathValue);
  } catch {
    throw new HistoryValidationError(`File path must be repository-relative and traversal-free: ${pathValue}`, { ...details, field: 'path' });
  }
  const added = integer(object.added, 'added', details, 0);
  const deleted = integer(object.deleted, 'deleted', details, 0);
  const rangeValues = stringArray(object.ranges, details, 'ranges');
  const ranges: ChangedLineRange[] = rangeValues.map((rangeValue, rangeIndex) => {
    const rangeObject = record(rangeValue, `ranges[${rangeIndex}]`, { ...details, field: 'ranges' });
    const start = integer(rangeObject.start, 'start', { ...details, field: `ranges[${rangeIndex}]` }, 1);
    const end = integer(rangeObject.end, 'end', { ...details, field: `ranges[${rangeIndex}]` }, 1);
    if (start > end) {
      throw new HistoryValidationError('Inclusive range start must be <= end.', { ...details, field: `ranges[${rangeIndex}]` });
    }
    return { start, end };
  }).sort((left, right) => left.start - right.start || left.end - right.end);
  return { path, added, deleted, ranges };
}

function parseCommit(value: unknown, source: string, commitRecord: number): GitCommit {
  const details = { source, record: commitRecord };
  const object = record(value, `commits[${commitRecord - 1}]`, details);
  const sha = requiredString(object, 'sha', details);
  if (!/^[0-9a-f]{40}$/.test(sha)) {
    throw new HistoryValidationError('sha must be exactly 40 lowercase hexadecimal characters.', { ...details, field: 'sha' });
  }
  const author = canonicalWhitespace(requiredString(object, 'author', details));
  const timestamp = requiredString(object, 'timestamp', details);
  let timestampUtc: string;
  try {
    timestampUtc = normalizeTimestampUtc(timestamp);
  } catch {
    throw new HistoryValidationError('timestamp must be a valid ISO-8601 value with Z or a numeric offset.', { ...details, field: 'timestamp' });
  }
  const messageValue = object.message ?? object.subject;
  if (typeof messageValue !== 'string' || canonicalWhitespace(messageValue).length === 0) {
    throw new HistoryValidationError('message or subject must be a non-empty string.', { ...details, field: 'message' });
  }
  if (object.message !== undefined && typeof object.message !== 'string') {
    throw new HistoryValidationError('message must be a string when present.', { ...details, field: 'message' });
  }
  if (object.subject !== undefined && typeof object.subject !== 'string') {
    throw new HistoryValidationError('subject must be a string when present.', { ...details, field: 'subject' });
  }
  if (!Array.isArray(object.files)) {
    throw new HistoryValidationError('files must be an array.', { ...details, field: 'files' });
  }
  const files = object.files.map((file, fileIndex) => parseFile(file, source, commitRecord, fileIndex));
  const byPath = new Map<string, ChangedFile>();
  for (const file of files) {
    const existing = byPath.get(file.path);
    if (existing !== undefined && !sameFile(existing, file)) {
      throw new HistoryValidationError(`Duplicate path has conflicting range/count data: ${file.path}`, { ...details, field: 'files' });
    }
    byPath.set(file.path, file);
  }
  return {
    sha,
    author,
    message: canonicalWhitespace(messageValue),
    subject: canonicalWhitespace(messageValue),
    timestampUtc,
    files: [...byPath.values()].sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0),
    source: { source, line: null, record: commitRecord } satisfies LogSourceRef,
  };
}

export function parseHistoryExport(text: string, parserOptions?: HistoryParserOptions): ParseOutcome<GitHistoryDocument> {
  const source = parserOptions?.source ?? 'history';
  if (text.trim().length === 0) return failure(new EmptyInputError({ source }));
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch {
    const error = new MalformedInputError('History export is not valid JSON.', { source, raw: text });
    return failure(error);
  }
  let root: JsonRecord;
  try {
    root = record(value, 'root', { source });
  } catch (error) {
    if (error instanceof HistoryValidationError) return failure(error);
    throw error;
  }
  const diagnostics: InputDiagnostic[] = [];
  try {
    if (root.schemaVersion !== 1) throw new HistoryValidationError('History schemaVersion must be 1.', { source, field: 'schemaVersion' });
    if (root.format !== 'culprit-json') throw new HistoryValidationError('History format must be "culprit-json".', { source, field: 'format' });
    const repository = canonicalWhitespace(requiredString(root, 'repository', { source }));
    if (!Array.isArray(root.commits) || root.commits.length === 0) {
      throw new HistoryValidationError('History commits must be a non-empty array.', { source, field: 'commits' });
    }
    const commits = root.commits.map((commit, index) => parseCommit(commit, source, index + 1));
    const bySha = new Map<string, GitCommit>();
    for (const commit of commits) {
      const existing = bySha.get(commit.sha);
      if (existing !== undefined) {
        if (JSON.stringify(existing) !== JSON.stringify(commit)) {
          throw new HistoryValidationError(`Duplicate SHA has conflicting commit data: ${commit.sha}`, { source, record: commit.source.record, field: 'sha' });
        }
        continue;
      }
      bySha.set(commit.sha, commit);
    }
    const canonicalCommits = [...bySha.values()].sort((left, right) => {
      const time = Date.parse(left.timestampUtc) - Date.parse(right.timestampUtc);
      return time || (left.sha < right.sha ? -1 : left.sha > right.sha ? 1 : 0);
    });
    return {
      ok: true,
      value: { schemaVersion: 1, format: 'culprit-json', repository, commits: canonicalCommits, diagnostics },
      diagnostics,
    };
  } catch (error) {
    if (error instanceof HistoryValidationError) {
      const entry = error.toDiagnostic();
      return { ok: false, error, diagnostics: [...diagnostics, entry] };
    }
    throw error;
  }
}
