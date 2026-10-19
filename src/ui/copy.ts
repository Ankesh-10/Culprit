import type { AnalysisStream } from '../core/model';
import { toAnalysisResult } from '../core/pipeline';
import { serializeMarkdown } from '../core/serialization';
import { clear, el, icon } from './dom';
import { COPY_FALLBACK_MESSAGE } from './state';
import type { CopyFeedback } from './state';

export { COPY_FALLBACK_MESSAGE };

export const COPY_BUTTON_LABEL = 'Copy Markdown postmortem';
export const HIDE_MARKDOWN_LABEL = 'Hide Markdown';

/**
 * The postmortem is projected from the stream on every copy and never cached, so what lands on the
 * clipboard is exactly what the deterministic serializer produces for the result on screen.
 */
export function buildPostmortemMarkdown(stream: AnalysisStream): string {
  return serializeMarkdown(toAnalysisResult(stream));
}

/** Newline-terminated lines: the serializer ends its output with a newline, so "70 lines" means 70 newlines. */
export function markdownLineCount(markdown: string): number {
  let count = 0;
  for (const character of markdown) {
    if (character === '\n') count += 1;
  }
  return count;
}

export interface CopyEnvironment {
  clipboard: { writeText(text: string): Promise<void> } | undefined;
  protocol: string;
}

/**
 * Writes through the async clipboard API only. A page opened from a local file, a missing clipboard or a
 * refused or throwing write all resolve to 'fallback' so the caller can reveal the text for a manual copy.
 */
export async function copyText(text: string, env: CopyEnvironment): Promise<'copied' | 'fallback'> {
  if (env.protocol === 'file:' || env.clipboard === undefined) return 'fallback';
  try {
    await env.clipboard.writeText(text);
    return 'copied';
  } catch {
    return 'fallback';
  }
}

export interface CopyHandlers {
  onCopy(): void;
  onHide(): void;
}

export interface CopyControl {
  element: HTMLElement;
  button: HTMLButtonElement;
  /** Repaint the status line and the fallback box. The button node (and so its focus) is never replaced. */
  update(feedback: CopyFeedback): void;
}

/**
 * The secondary button, an always-present polite status line and the fallback box. The button label never
 * changes; the status line carries the outcome so assistive technology keeps its focus target.
 */
export function renderCopyControl(feedback: CopyFeedback, handlers: CopyHandlers): CopyControl {
  const button = el('button', { className: 'button-secondary copy-button', attrs: { type: 'button' } }, [
    icon('copy', 'icon'),
    COPY_BUTTON_LABEL,
  ]);
  button.addEventListener('click', () => handlers.onCopy());

  const status = el('p', {
    className: 'copy-status',
    attrs: { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' },
  });

  const textarea = el('textarea', {
    className: 'copy-fallback-text',
    attrs: { readonly: '', rows: '8', spellcheck: 'false', 'aria-label': 'Postmortem Markdown' },
  });
  const hide = el('button', { className: 'button-secondary', text: HIDE_MARKDOWN_LABEL, attrs: { type: 'button' } });
  hide.addEventListener('click', () => {
    handlers.onHide();
    button.focus();
  });
  const fallback = el('div', { className: 'copy-fallback' }, [textarea, hide]);
  fallback.hidden = true;

  const element = el('div', { className: 'copy-control' }, [button, status, fallback]);

  let shownMarkdown = '';

  function paint(next: CopyFeedback, reveal: boolean): void {
    clear(status);
    status.className = 'copy-status';
    if (next.kind === 'copied') {
      status.classList.add('is-copied');
      status.append(icon('check', 'icon copy-status-icon'), el('span', { text: next.message }));
    } else if (next.kind === 'fallback') {
      status.classList.add('is-fallback');
      status.append(icon('alert-triangle', 'icon copy-status-icon'), el('span', { text: next.message }));
    }

    if (next.kind === 'fallback') {
      fallback.hidden = false;
      if (shownMarkdown !== next.markdown) {
        textarea.value = next.markdown;
        shownMarkdown = next.markdown;
      }
      if (reveal) {
        textarea.focus();
        textarea.select();
      }
    } else {
      fallback.hidden = true;
      textarea.value = '';
      shownMarkdown = '';
    }
  }

  paint(feedback, false);

  return {
    element,
    button,
    update(next) {
      // A fallback outcome always reveals and selects the text so Ctrl+C copies it.
      paint(next, next.kind === 'fallback');
    },
  };
}
