import { describe, expect, it } from 'vitest';
import { OWN_TOGGLE_ID, OWN_TOGGLE_TEXT } from '../../src/ui/case-picker';
import {
  activeEntry,
  filterEntries,
  initialPaletteState,
  isPaletteShortcut,
  paletteEntries,
  reducePalette,
  resultCountText,
} from '../../src/ui/palette-model';
import type { PaletteState } from '../../src/ui/palette-model';

const CASES = [
  { id: 'checkout-outage', name: 'Checkout outage', purpose: 'A sharp payment timeout spike.' },
  { id: 'slow-burn', name: 'Slow-burn inventory failure', purpose: 'A gradual error-rate ramp.' },
  { id: 'ambiguous', name: 'Ambiguous search regression', purpose: 'Competing pre-onset commits.' },
];

const ENTRIES = paletteEntries(CASES);

function labels(query: string): string[] {
  return filterEntries(ENTRIES, query).map((entry) => entry.label);
}

describe('paletteEntries', () => {
  it('lists the cases in order, then "Use your own files"', () => {
    expect(ENTRIES).toHaveLength(4);
    expect(ENTRIES.slice(0, 3)).toEqual([
      { id: 'checkout-outage', label: 'Checkout outage', hint: 'A sharp payment timeout spike.', kind: 'case' },
      { id: 'slow-burn', label: 'Slow-burn inventory failure', hint: 'A gradual error-rate ramp.', kind: 'case' },
      { id: 'ambiguous', label: 'Ambiguous search regression', hint: 'Competing pre-onset commits.', kind: 'case' },
    ]);
    expect(ENTRIES[3]).toEqual({
      id: 'own-files',
      label: 'Use your own files',
      hint: 'Paste or drop your own log and git history',
      kind: 'own',
    });
  });

  it('keeps the own-files id and label in step with the case picker', () => {
    expect(ENTRIES[3]?.id).toBe(OWN_TOGGLE_ID);
    expect(ENTRIES[3]?.label).toBe(OWN_TOGGLE_TEXT);
  });
});

describe('filterEntries', () => {
  it('returns every entry in order for an empty or blank query', () => {
    expect(filterEntries(ENTRIES, '')).toEqual(ENTRIES);
    expect(filterEntries(ENTRIES, '   ')).toEqual(ENTRIES);
  });

  it('matches case-insensitively on the label', () => {
    expect(labels('  SLOW ')).toEqual(['Slow-burn inventory failure']);
    expect(labels('files')).toEqual(['Use your own files']);
  });

  it('requires every whitespace-separated token', () => {
    expect(labels('checkout outage')).toEqual(['Checkout outage']);
    expect(labels('checkout regression')).toEqual([]);
  });

  it('does not search the hint text', () => {
    expect(labels('payment')).toEqual([]);
  });

  it('returns nothing, without throwing, for unmatched or markup-looking queries', () => {
    expect(labels('zzz')).toEqual([]);
    expect(labels('<img src=x onerror=alert(1)>')).toEqual([]);
    expect(labels('(((')).toEqual([]);
  });
});

describe('reducePalette', () => {
  it('resets the active row to the first match when the query changes', () => {
    const moved: PaletteState = { query: '', active: 2 };
    expect(reducePalette(moved, { type: 'query', value: 'a' }, ENTRIES)).toEqual({ query: 'a', active: 0 });
  });

  it('sets active to -1 when nothing matches', () => {
    expect(reducePalette(initialPaletteState, { type: 'query', value: 'zzz' }, ENTRIES)).toEqual({ query: 'zzz', active: -1 });
  });

  it('wraps around the visible list in both directions', () => {
    const last: PaletteState = { query: '', active: 3 };
    expect(reducePalette(last, { type: 'move', delta: 1 }, ENTRIES).active).toBe(0);
    expect(reducePalette(initialPaletteState, { type: 'move', delta: -1 }, ENTRIES).active).toBe(3);
    expect(reducePalette(initialPaletteState, { type: 'move', delta: 1 }, ENTRIES).active).toBe(1);
  });

  it('wraps within the filtered list, not the full one', () => {
    const filtered: PaletteState = { query: 'a', active: 0 };
    const visible = filterEntries(ENTRIES, 'a');
    expect(visible.length).toBeGreaterThan(1);
    expect(reducePalette(filtered, { type: 'move', delta: -1 }, ENTRIES).active).toBe(visible.length - 1);
  });

  it('keeps -1 when moving with no results', () => {
    const empty: PaletteState = { query: 'zzz', active: -1 };
    expect(reducePalette(empty, { type: 'move', delta: 1 }, ENTRIES).active).toBe(-1);
    expect(reducePalette(empty, { type: 'move', delta: -1 }, ENTRIES).active).toBe(-1);
  });
});

describe('activeEntry', () => {
  it('returns the visible entry at the active index', () => {
    expect(activeEntry({ query: '', active: 1 }, ENTRIES)?.id).toBe('slow-burn');
    expect(activeEntry({ query: 'files', active: 0 }, ENTRIES)?.id).toBe('own-files');
  });

  it('returns null when nothing is active or visible', () => {
    expect(activeEntry({ query: 'zzz', active: -1 }, ENTRIES)).toBeNull();
    expect(activeEntry({ query: '', active: 9 }, ENTRIES)).toBeNull();
  });
});

describe('resultCountText', () => {
  it('announces zero, one and many results', () => {
    expect(resultCountText(0)).toBe('No matching cases');
    expect(resultCountText(1)).toBe('1 result');
    expect(resultCountText(4)).toBe('4 results');
  });
});

describe('isPaletteShortcut', () => {
  const base = { key: '/', ctrlKey: false, metaKey: false, altKey: false, inEditable: false, modalOpen: false };

  it('opens on a bare slash outside editable targets', () => {
    expect(isPaletteShortcut(base)).toBe(true);
  });

  it('ignores slash inside an editable target or with ctrl', () => {
    expect(isPaletteShortcut({ ...base, inEditable: true })).toBe(false);
    expect(isPaletteShortcut({ ...base, ctrlKey: true })).toBe(false);
  });

  it('opens on Ctrl/Cmd+K even inside an editable target', () => {
    expect(isPaletteShortcut({ ...base, key: 'k', ctrlKey: true })).toBe(true);
    expect(isPaletteShortcut({ ...base, key: 'K', metaKey: true })).toBe(true);
    expect(isPaletteShortcut({ ...base, key: 'k', ctrlKey: true, inEditable: true })).toBe(true);
  });

  it('rejects Ctrl+Alt+K, a plain k and unrelated keys', () => {
    expect(isPaletteShortcut({ ...base, key: 'k', ctrlKey: true, altKey: true })).toBe(false);
    expect(isPaletteShortcut({ ...base, key: 'k' })).toBe(false);
    expect(isPaletteShortcut({ ...base, key: 'a' })).toBe(false);
  });

  it('does nothing while a modal dialog is open', () => {
    expect(isPaletteShortcut({ ...base, modalOpen: true })).toBe(false);
    expect(isPaletteShortcut({ ...base, key: 'k', ctrlKey: true, modalOpen: true })).toBe(false);
  });
});
