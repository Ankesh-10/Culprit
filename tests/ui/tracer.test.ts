import { describe, expect, it } from 'vitest';
import type { AnalysisStream } from '../../src/core/model';
import { BUNDLED_CASES, findCase, toAnalysisInput } from '../../src/ui/cases';
import type { BundledCase } from '../../src/ui/cases';
import { buildVerdictView } from '../../src/ui/view-model';
import { handleAnalyzeRequest } from '../../src/worker/protocol';
import type { AnalyzeResponse } from '../../src/worker/protocol';

function requireCase(id: string): BundledCase {
  const found = findCase(id);
  if (found === undefined) throw new Error(`missing case ${id}`);
  return found;
}

function analyzeCase(id: string, requestId = 1): AnalyzeResponse {
  return handleAnalyzeRequest({ type: 'analyze', requestId, input: toAnalysisInput(requireCase(id)) });
}

function streamOf(response: AnalyzeResponse): AnalysisStream {
  if (response.type !== 'result') throw new Error(`expected result, got ${response.type}`);
  return response.stream;
}

describe('bundled cases', () => {
  it('lists the three incidents in presentation order', () => {
    expect(BUNDLED_CASES.map((entry) => entry.id)).toEqual(['checkout-outage', 'slow-burn', 'ambiguous']);
    expect(BUNDLED_CASES.map((entry) => entry.name)).toEqual([
      'Checkout outage',
      'Slow-burn inventory failure',
      'Ambiguous search regression',
    ]);
  });
});

describe('handleAnalyzeRequest headlines', () => {
  it('names the checkout suspect and survives structured cloning', () => {
    const response = analyzeCase('checkout-outage');
    expect(response.type).toBe('result');
    expect(response.requestId).toBe(1);
    expect(structuredClone(response)).toEqual(response);
    const view = buildVerdictView(streamOf(structuredClone(response)));
    expect(view?.headline).toEqual({
      mode: 'suspect',
      shortSha: '2222222',
      subject: 'refactor: add payment provider retry path',
    });
    expect(view?.confidence.text).toBe('Ranking confidence: High');
    expect(view?.confidence.filled).toBe(3);
  });

  it('names the slow-burn suspect with medium confidence', () => {
    const view = buildVerdictView(streamOf(analyzeCase('slow-burn')));
    expect(view?.headline.mode).toBe('suspect');
    expect(view?.headline.shortSha).toBe('5555555');
    expect(view?.confidence.text).toBe('Ranking confidence: Medium');
  });

  it('reports no clear culprit with a leading candidate for the ambiguous case', () => {
    const view = buildVerdictView(streamOf(analyzeCase('ambiguous')));
    expect(view?.headline.mode).toBe('no-clear-culprit');
    expect(view?.headline.shortSha).toBe('9999999');
    expect(view?.confidence.filled).toBe(1);
  });
});

describe('handleAnalyzeRequest failures', () => {
  function withInput(patch: (input: ReturnType<typeof toAnalysisInput>) => void): AnalyzeResponse {
    const input = toAnalysisInput(requireCase('checkout-outage'));
    patch(input);
    return handleAnalyzeRequest({ type: 'analyze', requestId: 7, input });
  }

  it('returns plain EMPTY_INPUT data for an empty log without raw text', () => {
    const response = withInput((input) => {
      input.logs.text = '';
    });
    if (response.type !== 'error') throw new Error('expected error');
    expect(response.requestId).toBe(7);
    expect(response.failure.code).toBe('EMPTY_INPUT');
    expect(response.failure.message).toBe('Input is empty or contains only whitespace.');
    expect(response.failure).not.toBeInstanceOf(Error);
    expect(structuredClone(response)).toEqual(response);
    for (const diagnostic of response.failure.diagnostics) expect(diagnostic).not.toHaveProperty('raw');
  });

  it('returns MALFORMED_RECORD without raw text for broken history', () => {
    const response = withInput((input) => {
      input.history.text = '{';
    });
    if (response.type !== 'error') throw new Error('expected error');
    expect(response.failure.code).toBe('MALFORMED_RECORD');
    for (const diagnostic of response.failure.diagnostics) expect(diagnostic).not.toHaveProperty('raw');
    expect(structuredClone(response)).toEqual(response);
  });

  it('answers INVALID_REQUEST with request id -1 for an unknown shape', () => {
    const response = handleAnalyzeRequest({ type: 'nope' });
    if (response.type !== 'error') throw new Error('expected error');
    expect(response.requestId).toBe(-1);
    expect(response.failure.code).toBe('INVALID_REQUEST');
  });
});

describe('markup characters', () => {
  it('passes a subject with angle brackets through as a plain string', () => {
    const stream = structuredClone(streamOf(analyzeCase('checkout-outage')));
    const leading = stream.ranking.suspects[0];
    if (leading === undefined) throw new Error('no suspect');
    leading.subject = '<img src=x onerror=alert(1)> & "quotes"';
    const view = buildVerdictView(stream);
    expect(view?.headline.subject).toBe('<img src=x onerror=alert(1)> & "quotes"');
  });
});
