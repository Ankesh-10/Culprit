import { el, icon } from './dom';
import { canAnalyze, checkFileSize, detectLogFormat, detectedFormatLabel, fileChipText } from './intake';
import type { FieldDraft, LogFormatChoice, OwnInputDraft } from './intake';

/**
 * The own-files form. It is built once and updated in place by `refresh`, so typing in a text box or
 * choosing a control never loses focus to a re-render. Text reaches the page only as text nodes,
 * attributes and the textarea `value`; nothing here builds markup from user content. A chosen file is
 * size-checked from `File.size` before its bytes are read, and the keyboard path (Tab to the file
 * input, Enter or Space) never depends on drag-and-drop.
 */

export type FieldName = 'log' | 'history';

export const OWN_FORM_ID = 'own-files-form';
export const DISABLED_REASON = 'Add a log and a git history to analyze';
export const CLEAR_CONFIRM_TEXT =
  'Remove the loaded log and git history from this page? The current result stays until you load something new.';

export interface OwnFilesHandlers {
  /** The user changed a field; the owner stores the new draft. */
  onDraftChange(next: OwnInputDraft): void;
  onAnalyze(): void;
  /** The user confirmed Clear inputs; the owner empties its draft and dispatches `cleared`. */
  onClear(): void;
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
  fileInput: HTMLInputElement;
  zoneLabel: HTMLElement;
  zoneText: HTMLElement;
  removeButton: HTMLButtonElement;
  fileError: HTMLElement;
}

const FIELD_TITLE: Record<FieldName, string> = { log: 'Log', history: 'Git history' };
const FIELD_ACCEPT: Record<FieldName, string> = { log: '.jsonl,.log,.txt', history: '.json' };
const FIELD_HELPER: Record<FieldName, string> = {
  log: 'JSON-lines or plain text · up to 1 MiB · 10,000 events',
  history: 'Culprit JSON history export',
};
const DROP_PROMPT = 'Drop a file or choose one';
const DROP_ACTIVE = 'Release to load';

function withText(field: FieldDraft, text: string): FieldDraft {
  // Editing the text means it no longer matches a chosen file.
  return { ...field, text, fileName: null, fileSize: null };
}

export function renderOwnFilesForm(initial: OwnInputDraft, handlers: OwnFilesHandlers): OwnFilesForm {
  let current = initial;
  const readTokens: Record<FieldName, number> = { log: 0, history: 0 };

  function setField(name: FieldName, next: FieldDraft): void {
    current = { ...current, [name]: next };
    handlers.onDraftChange(current);
    refresh();
  }

  function showFileError(name: FieldName, message: string | null): void {
    const target = fields[name].fileError;
    target.textContent = '';
    target.hidden = message === null;
    if (message === null) return;
    target.append(icon('x-circle', 'icon'), el('span', { text: message }));
  }

  /** Size gate first (from `File.size`), then the bytes; a newer choice supersedes a slower read. */
  async function acceptFile(name: FieldName, file: File): Promise<void> {
    readTokens[name] += 1;
    const token = readTokens[name];
    const refusal = checkFileSize({ name: file.name, size: file.size });
    if (refusal !== null) {
      showFileError(name, refusal);
      return;
    }
    try {
      const text = await file.text();
      if (token !== readTokens[name]) return;
      showFileError(name, null);
      setField(name, { text, fileName: file.name, fileSize: file.size });
    } catch {
      if (token !== readTokens[name]) return;
      showFileError(name, `${file.name} couldn't be read. Choose it again.`);
    }
  }

  function removeFile(name: FieldName): void {
    readTokens[name] += 1;
    const view = fields[name];
    view.fileInput.value = '';
    showFileError(name, null);
    setField(name, { text: '', fileName: null, fileSize: null });
    view.fileInput.focus();
  }

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
      on: { input: () => setField(name, withText(current[name], textarea.value)) },
    });
    const details = el('details', { className: 'paste-disclosure' }, [el('summary', { text: 'Or paste text' }), textarea]);

    const fileInput = el('input', {
      className: 'visually-hidden-input',
      attrs: { type: 'file', id: `own-${name}-file`, accept: FIELD_ACCEPT[name] },
      on: {
        change: () => {
          const file = fileInput.files?.item(0) ?? null;
          if (file === null) return;
          // Reset so choosing the same file again after a refusal or removal still fires `change`.
          void acceptFile(name, file).finally(() => {
            fileInput.value = '';
          });
        },
      },
    });
    const zoneText = el('span', { className: 'drop-zone-text', text: DROP_PROMPT });
    const zoneLabel = el('label', { className: 'drop-zone' }, [
      fileInput,
      icon('file', 'icon drop-zone-icon'),
      zoneText,
      el('span', { className: 'drop-zone-helper', text: FIELD_HELPER[name] }),
    ]);
    const setDragging = (on: boolean): void => {
      zoneLabel.classList.toggle('is-drag-over', on);
      if (on) zoneText.textContent = DROP_ACTIVE;
      else refresh();
    };
    zoneLabel.addEventListener('dragenter', (event) => {
      event.preventDefault();
      setDragging(true);
    });
    zoneLabel.addEventListener('dragover', (event) => {
      event.preventDefault();
      setDragging(true);
    });
    zoneLabel.addEventListener('dragleave', (event) => {
      const next = event.relatedTarget;
      if (next instanceof Node && zoneLabel.contains(next)) return;
      setDragging(false);
    });
    zoneLabel.addEventListener('drop', (event) => {
      event.preventDefault();
      setDragging(false);
      const file = event.dataTransfer?.files.item(0) ?? null;
      if (file !== null) void acceptFile(name, file);
    });

    const removeButton = el('button', {
      className: 'button-secondary file-remove',
      text: 'Remove file',
      attrs: { type: 'button' },
      on: { click: () => removeFile(name) },
    });
    removeButton.hidden = true;
    const fileError = el('p', { className: 'file-error', attrs: { role: 'alert' } });
    fileError.hidden = true;

    const children: Node[] = [el('legend', { className: 'own-field-title', text: FIELD_TITLE[name] }), zoneLabel, removeButton, fileError];
    if (name === 'log') children.push(logFormatRow());
    if (name === 'history') children.push(el('p', { className: 'own-field-note', text: 'Format: Culprit JSON export' }));
    children.push(details);
    const root = el('fieldset', { className: 'own-field', attrs: { id: `own-${name}-field` } }, children);
    return { root, details, textarea, fileInput, zoneLabel, zoneText, removeButton, fileError };
  }

  const formatSelect = el('select', {
    className: 'own-select',
    attrs: { id: 'own-log-format' },
    on: {
      change: () => {
        current = { ...current, formatChoice: formatSelect.value as LogFormatChoice };
        handlers.onDraftChange(current);
        refresh();
      },
    },
  });
  for (const [value, label] of [
    ['auto', 'Auto-detect'],
    ['jsonl', 'JSON-lines'],
    ['plain-text', 'Plain text'],
  ] as const) {
    formatSelect.append(el('option', { text: label, attrs: { value } }));
  }
  const detected = el('span', { className: 'own-detected' });

  function logFormatRow(): HTMLElement {
    return el('div', { className: 'own-format' }, [
      el('label', { className: 'own-format-label', text: 'Log format', attrs: { for: 'own-log-format' } }),
      formatSelect,
      detected,
    ]);
  }

  const fields: Record<FieldName, FieldView> = { log: buildField('log'), history: buildField('history') };

  const analyze = el('button', {
    className: 'button-primary',
    text: 'Analyze incident',
    attrs: { type: 'button', 'aria-describedby': 'own-analyze-reason' },
    on: { click: () => handlers.onAnalyze() },
  });
  const reason = el('p', { className: 'own-reason', text: DISABLED_REASON, attrs: { id: 'own-analyze-reason' } });

  const clearButton = el('button', {
    className: 'button-secondary',
    text: 'Clear inputs',
    attrs: { type: 'button' },
    on: { click: () => openConfirm() },
  });
  const confirmClear = el('button', {
    className: 'button-destructive',
    text: 'Clear inputs',
    attrs: { type: 'button' },
    on: {
      click: () => {
        closeConfirm();
        handlers.onClear();
        clearButton.focus();
      },
    },
  });
  const keepButton = el('button', {
    className: 'button-secondary',
    text: 'Keep inputs',
    attrs: { type: 'button' },
    on: {
      click: () => {
        closeConfirm();
        clearButton.focus();
      },
    },
  });
  const confirmRow = el(
    'div',
    { className: 'clear-confirm', attrs: { role: 'group', 'aria-label': 'Confirm clearing inputs' } },
    [
      el('p', { className: 'clear-confirm-text' }, [el('strong', { text: 'Clear inputs:' }), ` ${CLEAR_CONFIRM_TEXT}`]),
      el('div', { className: 'clear-confirm-actions' }, [confirmClear, keepButton]),
    ],
  );
  confirmRow.hidden = true;
  confirmRow.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    closeConfirm();
    clearButton.focus();
  });

  function openConfirm(): void {
    clearButton.hidden = true;
    confirmRow.hidden = false;
    keepButton.focus();
  }

  function closeConfirm(): void {
    confirmRow.hidden = true;
    clearButton.hidden = false;
  }

  const actions = el('div', { className: 'own-actions' }, [analyze, reason, clearButton]);

  const element = el('div', { className: 'own-files', attrs: { id: OWN_FORM_ID, role: 'group', 'aria-label': 'Use your own files' } }, [
    el('div', { className: 'own-fields' }, [fields.log.root, fields.history.root]),
    actions,
    confirmRow,
  ]);

  function refresh(): void {
    const ready = canAnalyze(current);
    analyze.disabled = !ready;
    reason.hidden = ready;
    for (const name of ['log', 'history'] as const) {
      const view = fields[name];
      const field = current[name];
      if (view.textarea.value !== field.text) view.textarea.value = field.text;
      const loaded = field.fileName !== null && field.fileSize !== null;
      view.zoneLabel.classList.toggle('has-file', loaded);
      if (!view.zoneLabel.classList.contains('is-drag-over')) {
        view.zoneText.textContent =
          field.fileName !== null && field.fileSize !== null
            ? fileChipText({ fileName: field.fileName, fileSize: field.fileSize })
            : DROP_PROMPT;
      }
      view.removeButton.hidden = !loaded;
    }
    if (formatSelect.value !== current.formatChoice) formatSelect.value = current.formatChoice;
    const hasLog = current.log.text.trim() !== '';
    detected.textContent = current.formatChoice === 'auto' && hasLog ? detectedFormatLabel(detectLogFormat(current.log.text)) : '';
  }

  function sync(draft: OwnInputDraft): void {
    current = draft;
    // An emptied draft (after Clear inputs) also drops any stale refusal message.
    if (draft.log.text === '' && draft.history.text === '') {
      showFileError('log', null);
      showFileError('history', null);
    }
    refresh();
  }

  function focusField(name: FieldName): void {
    const view = fields[name];
    if (current[name].fileName === null) {
      view.details.open = true;
      view.textarea.focus();
    } else {
      view.fileInput.focus();
    }
  }

  sync(initial);
  return { element, sync, focusField };
}
