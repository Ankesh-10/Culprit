import type { AnalysisFailure } from '../worker/protocol';
import { createAnalysisClient } from './analysis-client';
import { BUNDLED_CASES, toAnalysisInput } from './cases';
import type { BundledCase } from './cases';
import { clear, el } from './dom';
import { renderVerdict } from './verdict';
import { buildVerdictView } from './view-model';
import type { AnalysisStream } from '../core/model';

function required<T extends HTMLElement>(doc: Document, id: string): T {
  const node = doc.getElementById(id);
  if (node === null) throw new Error(`Missing required element #${id}`);
  return node as T;
}

export function mountApp(doc: Document): void {
  const picker = required<HTMLElement>(doc, 'case-picker');
  const title = required<HTMLElement>(doc, 'result-title');
  const body = required<HTMLElement>(doc, 'result-body');
  const buttons = new Map<string, HTMLButtonElement>();
  const client = createAnalysisClient();
  let loadId = 0;

  function markLoaded(loadedId: string): void {
    for (const [id, button] of buttons) button.setAttribute('aria-pressed', id === loadedId ? 'true' : 'false');
  }

  function showResult(bundledCase: BundledCase, stream: AnalysisStream): void {
    title.hidden = false;
    title.textContent = `Result: ${bundledCase.name}`;
    clear(body);
    const view = buildVerdictView(stream);
    body.append(view === null ? el('p', { text: stream.ranking.interpretation }) : renderVerdict(view));
    title.focus();
  }

  function showError(failure: AnalysisFailure): void {
    title.hidden = false;
    title.textContent = "We couldn't analyze these inputs";
    clear(body);
    const messages = failure.diagnostics.length > 0 ? failure.diagnostics.map((entry) => entry.message) : [failure.message];
    body.append(el('ul', { className: 'problem-list' }, messages.map((message) => el('li', { text: message }))));
    title.focus();
  }

  function load(bundledCase: BundledCase): void {
    loadId += 1;
    const id = loadId;
    markLoaded(bundledCase.id);
    client.analyze(toAnalysisInput(bundledCase)).then(
      (response) => {
        if (id !== loadId) return;
        if (response.type === 'result') showResult(bundledCase, response.stream);
        else showError(response.failure);
      },
      (error: unknown) => {
        if (id !== loadId) return;
        const detail = error instanceof Error && error.message !== '' ? error.message : 'unknown error';
        showError({ code: 'INTERNAL_ERROR', message: `Analysis stopped unexpectedly: ${detail}`, diagnostics: [] });
      },
    );
  }

  for (const bundledCase of BUNDLED_CASES) {
    const button = el('button', {
      className: 'case-button',
      text: bundledCase.name,
      attrs: { type: 'button', 'aria-label': `Load ${bundledCase.name}`, 'aria-pressed': 'false' },
      on: { click: () => load(bundledCase) },
    });
    buttons.set(bundledCase.id, button);
    picker.append(button);
  }
}
