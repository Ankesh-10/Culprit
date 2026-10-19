import type { AnalysisStream } from '../core/model';
import type { AnalysisFailure } from '../worker/protocol';

/** The loading banner only appears for analyses slower than this, so quick loads never flash it. */
export const LOADING_BANNER_DELAY_MS = 150;

export type SettledState =
  | { phase: 'done'; requestId: number; label: string; stream: AnalysisStream }
  | { phase: 'error'; requestId: number; label: string; failure: AnalysisFailure };

export type PageState =
  | { phase: 'idle' }
  | { phase: 'loading'; requestId: number; label: string; showBanner: boolean; previous: SettledState | null }
  | SettledState;

export type PageEvent =
  | { type: 'start'; requestId: number; label: string }
  | { type: 'banner-due'; requestId: number }
  | { type: 'succeeded'; requestId: number; stream: AnalysisStream }
  | { type: 'failed'; requestId: number; failure: AnalysisFailure }
  | { type: 'cleared' };

export const initialPageState: PageState = { phase: 'idle' };

/** Pure transition function. Events that do not apply return the same state object. */
export function reducePage(state: PageState, event: PageEvent): PageState {
  switch (event.type) {
    case 'start': {
      const previous: SettledState | null =
        state.phase === 'done' || state.phase === 'error'
          ? state
          : state.phase === 'loading'
            ? state.previous
            : null;
      return { phase: 'loading', requestId: event.requestId, label: event.label, showBanner: false, previous };
    }
    case 'banner-due':
      if (state.phase !== 'loading' || state.requestId !== event.requestId || state.showBanner) return state;
      return { ...state, showBanner: true };
    case 'succeeded':
      if (state.phase !== 'loading' || state.requestId !== event.requestId) return state;
      return { phase: 'done', requestId: event.requestId, label: state.label, stream: event.stream };
    case 'failed':
      if (state.phase !== 'loading' || state.requestId !== event.requestId) return state;
      return { phase: 'error', requestId: event.requestId, label: state.label, failure: event.failure };
    case 'cleared':
      return state.phase === 'error' ? initialPageState : state;
  }
}

/** Schedules a callback after a delay and returns a function that cancels it. */
export type Scheduler = (callback: () => void, delayMs: number) => () => void;

/** Arms the 150 ms banner timer for one request. The returned function cancels it. */
export function scheduleLoadingBanner(
  requestId: number,
  schedule: Scheduler,
  dispatch: (event: PageEvent) => void,
): () => void {
  return schedule(() => dispatch({ type: 'banner-due', requestId }), LOADING_BANNER_DELAY_MS);
}

export const COPY_FALLBACK_MESSAGE = "Couldn't copy automatically. The Markdown is selected below. Press Ctrl+C (Cmd+C on Mac).";

/** Outcome of the "Copy Markdown postmortem" action; it lives until the next result, drawer interaction or copy. */
export type CopyFeedback =
  | { kind: 'idle' }
  | { kind: 'copied'; message: string }
  | { kind: 'fallback'; markdown: string; message: string };

export type CopyEvent =
  | { type: 'succeeded'; lines: number }
  | { type: 'fell-back'; markdown: string }
  | { type: 'reset' }
  | { type: 'hide' };

export const initialCopyFeedback: CopyFeedback = { kind: 'idle' };

/** Pure transition function with no timers: feedback stays until another event replaces it. */
export function reduceCopyFeedback(state: CopyFeedback, event: CopyEvent): CopyFeedback {
  switch (event.type) {
    case 'succeeded':
      return { kind: 'copied', message: `Markdown postmortem copied (${event.lines} ${event.lines === 1 ? 'line' : 'lines'}).` };
    case 'fell-back':
      return { kind: 'fallback', markdown: event.markdown, message: COPY_FALLBACK_MESSAGE };
    case 'reset':
      return state.kind === 'idle' ? state : initialCopyFeedback;
    case 'hide':
      return state.kind === 'fallback' ? initialCopyFeedback : state;
  }
}
