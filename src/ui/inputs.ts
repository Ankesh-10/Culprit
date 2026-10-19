import { el } from './dom';
import { canAnalyze } from './intake';
import type { FieldDraft, OwnInputDraft } from './intake';

/**
 * The own-files form. It is built once and updated in place by `sync`, so typing in a text box or
 * choosing a control never loses focus to a re-render. Text reaches the page only as text nodes,
 * attributes and the textarea `value`; nothing here builds markup from user content.
 */

export type FieldName = 'log' | 'history';

export const OWN_FORM_ID = 'own-files-form';
export const DISABLED_REASON = 'Add a log and a git history to analyze';

export interface OwnFilesHandlers {
  /** The user changed a field; the owner stores the new draft. */
  onDraftChange(next: OwnInputDraft): void;
  onAnalyze(): void;
}

export interface OwnFilesForm {
  element: HTMLElement;
  /** Bring the form in line with a draft changed from outside (for example after a clear). */
  sync(draft: OwnInputDraft): void;
  /** Open the paste box when the field has no file, then focus the control that fixes the field. */
  focusField(field: FieldName): void;
}

interface FieldView {
  root: HTMLElement;
  details: HTMLDetailsElement;
  textarea: HTMLTextAreaElement;
}

const FIELD_TITLE: Record<FieldName, string> = { log: 'Log', history: 'Git history' };

function withText(field: FieldDraft, text: string): FieldDraft {
  // Editing the text means it no longer matches a chosen file.
  return { ...field, text, fileName: null, fileSize: null };
}

export function renderOwnFilesForm(initial: OwnInputDraft, handlers: OwnFilesHandlers): OwnFilesForm {
  let current = initial;

  function buildField(name: FieldName): FieldView {
    const textarea = el('textarea', {
      className: 'own-textarea',
      attrs: {
        id: `own-${name}-text`,
        rows: '6',
        spellcheck: 'false',
        autocomplete: 'off',
        'aria-label': `${FIELD_TITLE[name]} text`,
      },
      on: {
        input: () => {
          current = { ...current, [name]: withText(current[name], textarea.value) };
          handlers.onDraftChange(current);
          refresh();
        },
      },
    });
    const details = el('details', { className: 'paste-disclosure' }, [
      el('summary', { text: 'Or paste text' }),
      textarea,
    ]);
    const children: Node[] = [el('legend', { className: 'own-field-title', text: FIELD_TITLE[name] }), details];
    if (name === 'history') children.push(el('p', { className: 'own-field-note', text: 'Format: Culprit JSON export' }));
    const root = el('fieldset', { className: 'own-field', attrs: { id: `own-${name}-field` } }, children);
    return { root, details, textarea };
  }

  const fields: Record<FieldName, FieldView> = { log: buildField('log'), history: buildField('history') };

  const analyze = el('button', {
    className: 'button-primary',
    text: 'Analyze incident',
    attrs: { type: 'button', 'aria-describedby': 'own-analyze-reason' },
    on: { click: () => handlers.onAnalyze() },
  });
  const reason = el('p', { className: 'own-reason', text: DISABLED_REASON, attrs: { id: 'own-analyze-reason' } });
  const actions = el('div', { className: 'own-actions' }, [analyze, reason]);

  const element = el('div', { className: 'own-files', attrs: { id: OWN_FORM_ID, role: 'group', 'aria-label': 'Use your own files' } }, [
    el('div', { className: 'own-fields' }, [fields.log.root, fields.history.root]),
    actions,
  ]);

  function refresh(): void {
    const ready = canAnalyze(current);
    analyze.disabled = !ready;
    reason.hidden = ready;
  }

  function sync(draft: OwnInputDraft): void {
    current = draft;
    for (const name of ['log', 'history'] as const) {
      const view = fields[name];
      if (view.textarea.value !== draft[name].text) view.textarea.value = draft[name].text;
    }
    refresh();
  }

  function focusField(name: FieldName): void {
    const view = fields[name];
    view.details.open = true;
    view.textarea.focus();
  }

  sync(initial);
  return { element, sync, focusField };
}
