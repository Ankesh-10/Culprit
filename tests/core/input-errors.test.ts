import { describe, expect, it } from 'vitest';
import { EmptyInputError, HistoryValidationError, InputLimitError, MalformedInputError, UnsupportedFormatError } from '../../src/core/input-errors';
import type { ParseOutcome } from '../../src/core/input-errors';

describe('typed input errors', () => {
  it('keeps stable codes and nullable source context', () => {
    const errors = [
      new EmptyInputError({ source: 'logs' }),
      new MalformedInputError('bad record', { source: 'logs', line: 2, record: 2 }),
      new UnsupportedFormatError('unknown format'),
      new InputLimitError('too large'),
      new HistoryValidationError('bad history', { source: 'history', record: 1, field: 'commits' }),
    ];
    expect(errors.map((error) => error.code)).toEqual(['EMPTY_INPUT', 'MALFORMED_RECORD', 'UNSUPPORTED_FORMAT', 'INPUT_LIMIT', 'HISTORY_VALIDATION']);
    expect(errors[1]?.line).toBe(2);
    expect(errors[0]?.record).toBeNull();
    expect(errors[4]?.toDiagnostic().field).toBe('commits');
  });

  it('models successful and failed recoverable outcomes', () => {
    const success: ParseOutcome<string> = { ok: true, value: 'ok', diagnostics: [] };
    const error = new MalformedInputError('bad');
    const failure: ParseOutcome<string> = { ok: false, error, diagnostics: [error.toDiagnostic()] };
    expect(success.ok).toBe(true);
    expect(failure.ok).toBe(false);
    if (!failure.ok) expect(failure.error.code).toBe('MALFORMED_RECORD');
  });
});
