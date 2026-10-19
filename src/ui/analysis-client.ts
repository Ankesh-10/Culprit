import type { AnalysisInput } from '../core/model';
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

export function createAnalysisClient(_options: AnalysisClientOptions = {}): AnalysisClient {
  return {
    analyze: () => Promise.reject(new Error('not implemented')),
    dispose: () => undefined,
  };
}
