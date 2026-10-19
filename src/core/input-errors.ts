export type InputErrorCode =
  | 'EMPTY_INPUT'
  | 'MALFORMED_RECORD'
  | 'UNSUPPORTED_FORMAT'
  | 'INPUT_LIMIT'
  | 'INVALID_TIMESTAMP'
  | 'STACK_ATTACHMENT'
  | 'MISSING_FIELD'
  | 'INVALID_FIELD'
  | 'INVALID_PATH'
  | 'DUPLICATE_RECORD'
  | 'HISTORY_VALIDATION';

export interface InputDiagnostic {
  source: string;
  code: InputErrorCode;
  message: string;
  line: number | null;
  record: number | null;
  field: string | null;
  raw: string | null;
}

export interface InputErrorDetails {
  source?: string;
  line?: number | null;
  record?: number | null;
  field?: string | null;
  raw?: string | null;
}

export class CoreInputError extends Error {
  readonly code: InputErrorCode;
  readonly source: string;
  readonly line: number | null;
  readonly record: number | null;
  readonly field: string | null;
  readonly raw: string | null;

  constructor(code: InputErrorCode, message: string, details: InputErrorDetails = {}) {
    super(message);
    this.name = 'CoreInputError';
    this.code = code;
    this.source = details.source ?? 'input';
    this.line = details.line ?? null;
    this.record = details.record ?? null;
    this.field = details.field ?? null;
    this.raw = details.raw ?? null;
  }

  toDiagnostic(): InputDiagnostic {
    return {
      source: this.source,
      code: this.code,
      message: this.message,
      line: this.line,
      record: this.record,
      field: this.field,
      raw: this.raw,
    };
  }
}

export class EmptyInputError extends CoreInputError {
  constructor(details: InputErrorDetails = {}) {
    super('EMPTY_INPUT', 'Input is empty or contains only whitespace.', details);
    this.name = 'EmptyInputError';
  }
}

export class MalformedInputError extends CoreInputError {
  constructor(message: string, details: InputErrorDetails = {}) {
    super('MALFORMED_RECORD', message, details);
    this.name = 'MalformedInputError';
  }
}

export class UnsupportedFormatError extends CoreInputError {
  constructor(message: string, details: InputErrorDetails = {}) {
    super('UNSUPPORTED_FORMAT', message, details);
    this.name = 'UnsupportedFormatError';
  }
}

export class InputLimitError extends CoreInputError {
  constructor(message: string, details: InputErrorDetails = {}) {
    super('INPUT_LIMIT', message, details);
    this.name = 'InputLimitError';
  }
}

export class HistoryValidationError extends CoreInputError {
  constructor(message: string, details: InputErrorDetails = {}) {
    super('HISTORY_VALIDATION', message, details);
    this.name = 'HistoryValidationError';
  }
}

export type ParseOutcome<T> =
  | { ok: true; value: T; diagnostics: InputDiagnostic[] }
  | { ok: false; error: CoreInputError; diagnostics: InputDiagnostic[] };
