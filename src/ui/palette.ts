import { clear, el } from './dom';
import { activeEntry, filterEntries, initialPaletteState, isPaletteShortcut, reducePalette, resultCountText } from './palette-model';
import type { PaletteEntry, PaletteEvent, PaletteState } from './palette-model';

/**
 * The command palette: a native modal <dialog> holding a search box (combobox) and a listbox of the bundled
 * cases plus "Use your own files". It supplements the existing controls and never replaces them. Native
 * showModal() makes the rest of the page inert, Esc and a backdrop click close it, and focus returns to the
 * control that opened it. The typed query is only used as the input value and as filter text; nothing the
 * user types is ever inserted into the page.
 */

export interface PaletteOptions {
  entries: readonly PaletteEntry[];
  /** A bundled case was chosen. The palette has already closed. */
  onLoad(id: string): void;
  /** "Use your own files" was chosen. The palette has already closed and does not restore focus. */
  onOwnFiles(): void;
}

function required<T extends HTMLElement>(doc: Document, id: string): T {
  const node = doc.getElementById(id);
  if (node === null) throw new Error(`Missing required element #${id}`);
  return node as T;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
}

export function mountCommandPalette(doc: Document, options: PaletteOptions): void {
  const dialog = required<HTMLDialogElement>(doc, 'command-palette');
  const trigger = required<HTMLButtonElement>(doc, 'palette-trigger');
  const { entries } = options;

  let state: PaletteState = initialPaletteState;
  let opener: HTMLElement | null = null;
  let skipFocusReturn = false;

  const input = el('input', {
    className: 'palette-input',
    attrs: {
      id: 'palette-input',
      type: 'search',
      autocomplete: 'off',
      spellcheck: 'false',
      placeholder: 'Search cases',
      role: 'combobox',
      'aria-expanded': 'true',
      'aria-controls': 'palette-list',
      'aria-autocomplete': 'list',
      'aria-labelledby': 'palette-title',
    },
  });
  const list = el('ul', { className: 'palette-list', attrs: { id: 'palette-list', role: 'listbox', 'aria-label': 'Cases' } });
  const count = el('p', { className: 'palette-count', attrs: { role: 'status' } });
  const closeButton = el('button', {
    className: 'button-secondary',
    text: 'Close',
    attrs: { type: 'button' },
    on: { click: () => dialog.close() },
  });
  const hint = el('p', { className: 'key-hint' }, [
    el('kbd', { text: '↑' }),
    ' ',
    el('kbd', { text: '↓' }),
    ' move, ',
    el('kbd', { text: 'Enter' }),
    ' load, ',
    el('kbd', { text: 'Esc' }),
    ' close',
  ]);
  dialog.append(
    el('div', { className: 'palette-body' }, [
      el('h2', { text: 'Jump to a case', attrs: { id: 'palette-title' } }),
      input,
      list,
      count,
      el('div', { className: 'palette-footer' }, [hint, closeButton]),
    ]),
  );

  function choose(entry: PaletteEntry): void {
    if (entry.kind === 'own') {
      skipFocusReturn = true;
      dialog.close();
      options.onOwnFiles();
      return;
    }
    dialog.close();
    options.onLoad(entry.id);
  }

  function render(): void {
    const visible = filterEntries(entries, state.query);
    clear(list);
    visible.forEach((entry, index) => {
      const selected = index === state.active;
      list.append(
        el(
          'li',
          {
            className: selected ? 'palette-option is-active' : 'palette-option',
            attrs: { id: `palette-option-${entry.id}`, role: 'option', 'aria-selected': selected ? 'true' : 'false' },
            on: { click: () => choose(entry) },
          },
          [el('span', { className: 'palette-label', text: entry.label }), el('span', { className: 'palette-hint', text: entry.hint })],
        ),
      );
    });
    const active = activeEntry(state, entries);
    if (active === null) input.removeAttribute('aria-activedescendant');
    else input.setAttribute('aria-activedescendant', `palette-option-${active.id}`);
    const text = resultCountText(visible.length);
    if (count.textContent !== text) count.textContent = text;
  }

  function dispatch(event: PaletteEvent): void {
    state = reducePalette(state, event, entries);
    render();
  }

  function open(): void {
    if (dialog.open) return;
    const active = doc.activeElement;
    opener = active instanceof HTMLElement && active !== doc.body ? active : trigger;
    state = initialPaletteState;
    input.value = '';
    render();
    dialog.showModal();
    input.focus();
  }

  input.addEventListener('input', () => dispatch({ type: 'query', value: input.value }));
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      dispatch({ type: 'move', delta: event.key === 'ArrowDown' ? 1 : -1 });
    } else if (event.key === 'Escape') {
      // A search field uses Escape to clear itself first; here it always closes the palette in one press.
      event.preventDefault();
      dialog.close();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const entry = activeEntry(state, entries);
      if (entry !== null) choose(entry);
    }
  });

  dialog.addEventListener('close', () => {
    if (skipFocusReturn) {
      skipFocusReturn = false;
      return;
    }
    const target = opener !== null && opener.isConnected ? opener : trigger;
    target.focus();
  });
  // A click on the backdrop lands on the dialog element itself, never on its content.
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });

  trigger.addEventListener('click', open);
  doc.addEventListener('keydown', (event) => {
    if (event.defaultPrevented || event.isComposing) return;
    const shortcut = isPaletteShortcut({
      key: event.key,
      ctrlKey: event.ctrlKey,
      metaKey: event.metaKey,
      altKey: event.altKey,
      inEditable: isEditableTarget(event.target),
      modalOpen: doc.querySelector('dialog[open]') !== null,
    });
    if (!shortcut) return;
    event.preventDefault();
    open();
  });
}
