import { describe, expect, it } from 'vitest';
import type { AnalysisInput, AnalysisStream } from '../../src/core/model';
import { createAnalysisClient } from '../../src/ui/analysis-client';
import type { WorkerLike } from '../../src/ui/analysis-client';
import { BUNDLED_CASES, findCase, toAnalysisInput } from '../../src/ui/cases';
import type { BundledCase } from '../../src/ui/cases';
import { buildVerdictView } from '../../src/ui/view-model';
import { handleAnalyzeRequest } from '../../src/worker/protocol';
import type { AnalyzeRequest, AnalyzeResponse } from '../../src/worker/protocol';

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

describe('analysis client', () => {
  type Listener = (event: Event) => void;

  /** A worker double: postMessage clones the request and replies later, like a real worker. */
  class FakeWorker implements WorkerLike {
    readonly listeners: Record<string, Listener[]> = { message: [], error: [], messageerror: [] };
    terminated = false;
    posted = 0;

    constructor(private readonly behaviour: 'ok' | 'error-first' | 'stray-first' = 'ok') {}

    postMessage(message: AnalyzeRequest): void {
      this.posted += 1;
      const request = structuredClone(message);
      const first = this.posted === 1;
      setTimeout(() => {
        if (this.behaviour === 'error-first' && first) {
          this.emit('error', {} as Event);
          return;
        }
        if (this.behaviour === 'stray-first' && first) {
          this.emit('message', { data: { type: 'error', requestId: 9999, failure: { code: 'X', message: 'x', diagnostics: [] } } } as MessageEvent);
        }
        this.emit('message', { data: handleAnalyzeRequest(request) } as MessageEvent);
      }, 0);
    }

    addEventListener(type: 'message' | 'error' | 'messageerror', listener: Listener): void {
      this.listeners[type]?.push(listener);
    }

    terminate(): void {
      this.terminated = true;
    }

    private emit(type: string, event: Event): void {
      for (const listener of this.listeners[type] ?? []) listener(event);
    }
  }

  const checkoutInput = (): AnalysisInput => toAnalysisInput(requireCase('checkout-outage'));
  const slowBurnInput = (): AnalysisInput => toAnalysisInput(requireCase('slow-burn'));
  const shaOf = (response: AnalyzeResponse): string | undefined => streamOf(response).ranking.suspects[0]?.shortSha;

  it('answers on the main thread when no worker can be created', async () => {
    const client = createAnalysisClient({ createWorker: () => null });
    const response = await client.analyze(checkoutInput());
    const direct = analyzeCase('checkout-outage');
    expect(JSON.stringify(streamOf(response))).toBe(JSON.stringify(streamOf(direct)));
  });

  it('answers on the main thread when worker creation throws', async () => {
    const client = createAnalysisClient({
      createWorker: () => {
        throw new Error('no workers here');
      },
    });
    expect(shaOf(await client.analyze(checkoutInput()))).toBe('2222222');
  });

  it('resolves concurrent requests to their own request ids', async () => {
    const worker = new FakeWorker();
    const client = createAnalysisClient({ createWorker: () => worker });
    const [first, second] = await Promise.all([client.analyze(checkoutInput()), client.analyze(slowBurnInput())]);
    expect(first.requestId).not.toBe(second.requestId);
    expect(shaOf(first)).toBe('2222222');
    expect(shaOf(second)).toBe('5555555');
    expect(worker.posted).toBe(2);
  });

  it('falls back to the main thread after a worker error and terminates the worker', async () => {
    const worker = new FakeWorker('error-first');
    const client = createAnalysisClient({ createWorker: () => worker });
    expect(shaOf(await client.analyze(checkoutInput()))).toBe('2222222');
    expect(worker.terminated).toBe(true);
    expect(shaOf(await client.analyze(slowBurnInput()))).toBe('5555555');
    expect(worker.posted).toBe(1);
  });

  it('ignores a message with an unknown request id', async () => {
    const worker = new FakeWorker('stray-first');
    const client = createAnalysisClient({ createWorker: () => worker });
    expect(shaOf(await client.analyze(checkoutInput()))).toBe('2222222');
  });
});
