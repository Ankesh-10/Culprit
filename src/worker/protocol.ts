import type { InputDiagnostic } from '../core/input-errors';
import type { AnalysisInput, AnalysisOutcome, AnalysisStream } from '../core/model';
import { analyze } from '../core/pipeline';

/** A parser diagnostic without the raw input text, which can hold an entire supplied file. */
export type UiDiagnostic = Omit<InputDiagnostic, 'raw'>;

/** Plain, structured-clone-safe failure data: no Error instance and no raw input text. */
export interface AnalysisFailure {
  code: string;
  message: string;
  diagnostics: UiDiagnostic[];
}

export interface AnalyzeRequest {
  type: 'analyze';
  requestId: number;
  input: AnalysisInput;
}

export type AnalyzeResponse =
  | { type: 'result'; requestId: number; stream: AnalysisStream }
  | { type: 'error'; requestId: number; failure: AnalysisFailure };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isAnalyzeRequest(value: unknown): value is AnalyzeRequest {
  if (!isObject(value)) return false;
  if (value['type'] !== 'analyze') return false;
  if (!Number.isInteger(value['requestId'])) return false;
  const input = value['input'];
  return isObject(input) && isObject(input['logs']) && isObject(input['history']);
}

type FailedOutcome = Extract<AnalysisOutcome, { ok: false }>;

export function toAnalysisFailure(outcome: FailedOutcome): AnalysisFailure {
  const error = outcome.error as { code?: unknown; message?: unknown };
  return {
    code: typeof error.code === 'string' ? error.code : 'INVALID_ANALYSIS_INPUT',
    message: typeof error.message === 'string' ? error.message : 'The inputs could not be analyzed.',
    diagnostics: outcome.diagnostics.map((diagnostic) => ({
      source: diagnostic.source,
      code: diagnostic.code,
      message: diagnostic.message,
      line: diagnostic.line,
      record: diagnostic.record,
      field: diagnostic.field,
    })),
  };
}

function errorResponse(requestId: number, code: string, message: string): AnalyzeResponse {
  return { type: 'error', requestId, failure: { code, message, diagnostics: [] } };
}

/** Shared by the worker and the main-thread fallback. Never throws. */
export function handleAnalyzeRequest(value: unknown): AnalyzeResponse {
  if (!isAnalyzeRequest(value)) {
    const candidate = isObject(value) ? value['requestId'] : undefined;
    const requestId = typeof candidate === 'number' && Number.isInteger(candidate) ? candidate : -1;
    return errorResponse(requestId, 'INVALID_REQUEST', 'The analysis request was not understood.');
  }
  try {
    const outcome = analyze(value.input);
    if (outcome.ok) return { type: 'result', requestId: value.requestId, stream: outcome.stream };
    return { type: 'error', requestId: value.requestId, failure: toAnalysisFailure(outcome) };
  } catch (error) {
    const detail = error instanceof Error && error.message !== '' ? error.message : 'unknown error';
    return errorResponse(value.requestId, 'INTERNAL_ERROR', `Analysis stopped unexpectedly: ${detail}`);
  }
}
