import { DEFAULT_LOG_LIMITS } from '../core/log-parser';
import type { AnalysisInput, LogFormat } from '../core/model';
import { normalizeRepositoryPath } from '../core/normalization';

/**
 * Pure helpers for the own-files path: format detection, source naming and input assembly. Nothing
 * here touches the DOM or the file system, so every rule is testable without a browser.
 */

export type LogFormatChoice = 'auto' | 'jsonl' | 'plain-text';

export interface FieldDraft {
  text: string;
  fileName: string | null;
  fileSize: number | null;
}

export interface OwnInputDraft {
  log: FieldDraft;
  history: FieldDraft;
  formatChoice: LogFormatChoice;
}

export interface InputSources {
  logs: string;
  history: string;
}

function emptyField(): FieldDraft {
  return { text: '', fileName: null, fileSize: null };
}

export function emptyDraft(): OwnInputDraft {
  return { log: emptyField(), history: emptyField(), formatChoice: 'auto' };
}

/** Deterministic rule: a first non-empty line starting with `{` is JSON-lines, anything else is plain text. */
export function detectLogFormat(text: string): LogFormat {
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === '') continue;
    return trimmed.startsWith('{') ? 'jsonl' : 'plain-text';
  }
  return 'plain-text';
}

export function resolveLogFormat(choice: LogFormatChoice, text: string): LogFormat {
  return choice === 'auto' ? detectLogFormat(text) : choice;
}

export function canAnalyze(draft: OwnInputDraft): boolean {
  return draft.log.text.trim() !== '' && draft.history.text.trim() !== '';
}

/** A chosen file name is user-controlled; only a name that passes the core path rules becomes a source. */
export function safeSourceName(name: string, fallback: string): string {
  try {
    return normalizeRepositoryPath(name);
  } catch {
    return fallback;
  }
}

/** Source names for the two fields; they are always distinct so a diagnostic maps to exactly one field. */
export function sourcesFor(draft: OwnInputDraft): InputSources {
  const logs = draft.log.fileName === null ? 'pasted-log' : safeSourceName(draft.log.fileName, 'uploaded-log');
  const historyBase =
    draft.history.fileName === null ? 'pasted-history' : safeSourceName(draft.history.fileName, 'uploaded-history');
  const history = historyBase === logs ? `history/${historyBase}` : historyBase;
  return { logs, history };
}

export function buildOwnAnalysisInput(draft: OwnInputDraft): AnalysisInput {
  const sources = sourcesFor(draft);
  return {
    logs: { text: draft.log.text, format: resolveLogFormat(draft.formatChoice, draft.log.text), source: sources.logs },
    history: { text: draft.history.text, format: 'culprit-json', source: sources.history },
    options: null,
  };
}

/** The `Result: {label}` heading names the chosen log file, else the pasted log. */
export function resultLabel(draft: OwnInputDraft): string {
  return draft.log.fileName === null ? 'pasted log' : draft.log.fileName;
}

export const MAX_INPUT_FILE_BYTES: number = DEFAULT_LOG_LIMITS.maxLogBytes;
