import type { AnalysisInput } from '../core/model';
import { handleAnalyzeRequest } from '../worker/protocol';
import type { AnalyzeRequest, AnalyzeResponse } from '../worker/protocol';

export interface WorkerLike {
  postMessage(message: AnalyzeRequest): void;
  addEventListener(type: 'message' | 'error' | 'messageerror', listener: (event: Event) => void): void;
  terminate(): void;
}

export interface AnalysisClient {
  analyze(input: AnalysisInput): Promise<AnalyzeResponse>;
  dispose(): void;
}

export interface AnalysisClientOptions {
  createWorker?: () => WorkerLike | null;
}

function createDefaultWorker(): WorkerLike | null {
  try {
    return new Worker(new URL('../worker/analyze.worker.ts', import.meta.url), { type: 'module' }) as unknown as WorkerLike;
  } catch {
    return null;
  }
}

function asResponse(data: unknown): AnalyzeResponse | null {
  if (typeof data !== 'object' || data === null) return null;
  const candidate = data as { type?: unknown; requestId?: unknown };
  if (candidate.type !== 'result' && candidate.type !== 'error') return null;
  if (!Number.isInteger(candidate.requestId)) return null;
  return data as AnalyzeResponse;
}

interface Pending {
  request: AnalyzeRequest;
  resolve: (response: AnalyzeResponse) => void;
}

/** Runs analysis in a module worker; answers on the main thread when the worker cannot start or fails. */
export function createAnalysisClient(options: AnalysisClientOptions = {}): AnalysisClient {
  const createWorker = options.createWorker ?? createDefaultWorker;
  const pending = new Map<number, Pending>();
  let worker: WorkerLike | null = null;
  let started = false;
  let mainThread = false;
  let nextRequestId = 1;

  function settle(response: AnalyzeResponse): void {
    const entry = pending.get(response.requestId);
    if (entry === undefined) return;
    pending.delete(response.requestId);
    entry.resolve(response);
  }

  function runOnMainThread(request: AnalyzeRequest): void {
    setTimeout(() => settle(handleAnalyzeRequest(request)), 0);
  }

  function fallBack(): void {
    if (worker !== null) {
      try {
        worker.terminate();
      } catch {
        // The worker is already unusable; the main-thread path takes over.
      }
      worker = null;
    }
    mainThread = true;
    for (const entry of [...pending.values()]) runOnMainThread(entry.request);
  }

  function start(): void {
    if (started) return;
    started = true;
    let created: WorkerLike | null = null;
    try {
      created = createWorker();
    } catch {
      created = null;
    }
    if (created === null) {
      mainThread = true;
      return;
    }
    worker = created;
    created.addEventListener('message', (event) => {
      const response = asResponse((event as MessageEvent<unknown>).data);
      if (response !== null) settle(response);
    });
    created.addEventListener('error', fallBack);
    created.addEventListener('messageerror', fallBack);
  }

  return {
    analyze(input) {
      start();
      const requestId = nextRequestId;
      nextRequestId += 1;
      const request: AnalyzeRequest = { type: 'analyze', requestId, input };
      return new Promise<AnalyzeResponse>((resolve) => {
        pending.set(requestId, { request, resolve });
        if (mainThread || worker === null) {
          runOnMainThread(request);
          return;
        }
        try {
          worker.postMessage(request);
        } catch {
          fallBack();
        }
      });
    },
    dispose() {
      if (worker !== null) worker.terminate();
      worker = null;
    },
  };
}
