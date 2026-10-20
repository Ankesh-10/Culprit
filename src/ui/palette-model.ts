import { OWN_TOGGLE_ID, OWN_TOGGLE_TEXT } from './case-picker';

/**
 * Pure model of the command palette: the entries, the filter, the keyboard reducer, the polite count text
 * and the shortcut predicate. No DOM. The typed query only ever feeds a lower-cased substring filter.
 */

export interface PaletteEntry {
  id: string;
  label: string;
  hint: string;
  kind: 'case' | 'own';
}

const OWN_HINT = 'Paste or drop your own log and git history';

export function paletteEntries(cases: ReadonlyArray<{ id: string; name: string; purpose: string }>): PaletteEntry[] {
  const entries: PaletteEntry[] = cases.map((entry) => ({ id: entry.id, label: entry.name, hint: entry.purpose, kind: 'case' }));
  entries.push({ id: OWN_TOGGLE_ID, label: OWN_TOGGLE_TEXT, hint: OWN_HINT, kind: 'own' });
  return entries;
}

/** Entries whose label contains every whitespace-separated token of `query`, case-insensitively, in order. */
export function filterEntries(entries: readonly PaletteEntry[], query: string): PaletteEntry[] {
  const tokens = query
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token !== '');
  if (tokens.length === 0) return [...entries];
  return entries.filter((entry) => {
    const label = entry.label.toLowerCase();
    return tokens.every((token) => label.includes(token));
  });
}

export interface PaletteState {
  query: string;
  /** Index into the visible (filtered) list, or -1 when nothing matches. */
  active: number;
}

export const initialPaletteState: PaletteState = { query: '', active: 0 };

export type PaletteEvent = { type: 'query'; value: string } | { type: 'move'; delta: 1 | -1 };

export function reducePalette(state: PaletteState, event: PaletteEvent, entries: readonly PaletteEntry[]): PaletteState {
  if (event.type === 'query') {
    const visible = filterEntries(entries, event.value);
    return { query: event.value, active: visible.length === 0 ? -1 : 0 };
  }
  const count = filterEntries(entries, state.query).length;
  if (count === 0) return state.active === -1 ? state : { ...state, active: -1 };
  const from = state.active < 0 ? (event.delta === 1 ? -1 : 0) : state.active;
  return { ...state, active: (from + event.delta + count) % count };
}

export function activeEntry(state: PaletteState, entries: readonly PaletteEntry[]): PaletteEntry | null {
  return filterEntries(entries, state.query)[state.active] ?? null;
}

export function resultCountText(count: number): string {
  if (count === 0) return 'No matching cases';
  return count === 1 ? '1 result' : `${count} results`;
}

export interface ShortcutEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  /** The event target is a text field, select or contenteditable element. */
  inEditable: boolean;
  /** Some modal dialog is already open. */
  modalOpen: boolean;
}

/** `/` outside text fields, or Ctrl/Cmd+K anywhere, opens the palette unless a modal is already open. */
export function isPaletteShortcut(event: ShortcutEvent): boolean {
  if (event.modalOpen || event.altKey) return false;
  if (event.key === '/') return !event.ctrlKey && !event.metaKey && !event.inEditable;
  if (event.key === 'k' || event.key === 'K') return event.ctrlKey || event.metaKey;
  return false;
}
