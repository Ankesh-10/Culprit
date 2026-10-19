import { handleAnalyzeRequest } from './protocol';
import type { AnalyzeResponse } from './protocol';

interface WorkerScope {
  addEventListener(type: 'message', listener: (event: MessageEvent<unknown>) => void): void;
  postMessage(message: AnalyzeResponse): void;
}

const scope = self as unknown as WorkerScope;

scope.addEventListener('message', (event) => {
  scope.postMessage(handleAnalyzeRequest(event.data));
});
