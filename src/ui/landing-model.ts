import type { SignalName } from '../core/model';
import { SIGNAL_ORDER } from '../core/scoring';
import { formatInteger } from './format';

/**
 * DOM-free helpers for the landing view. Everything here is a pure function of its arguments so the
 * page logic can be tested without a browser. The core constants are only read, never changed.
 */

/** Prefix every whitespace-separated id reference: 'a b' with prefix 'p' gives 'p-a p-b'. */
export function prefixIdRefs(value: string, prefix: string): string {
  return value
    .split(/\s+/)
    .filter((token) => token !== '')
    .map((token) => `${prefix}-${token}`)
    .join(' ');
}

export const FEATURE_TABS = [
  { id: 'onset', label: 'Onset detection' },
  { id: 'suspects', label: 'Ranked suspects' },
  { id: 'timeline', label: 'Linked timeline' },
  { id: 'drawer', label: 'Evidence drawer' },
  { id: 'postmortem', label: 'Markdown postmortem' },
  { id: 'offline', label: 'Private and offline' },
] as const;

export type FeatureTabId = (typeof FEATURE_TABS)[number]['id'];

/**
 * The WAI-ARIA tabs keyboard model with automatic activation: the index to move to for `key`, or null when
 * the key is not a tab-navigation key. A current index outside the list is clamped first.
 */
export function tabKeyTarget(current: number, key: string, count: number): number | null {
  if (count <= 0) return null;
  const at = Math.min(count - 1, Math.max(0, Math.trunc(current)));
  switch (key) {
    case 'ArrowRight':
      return (at + 1) % count;
    case 'ArrowLeft':
      return (at - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

const SIGNAL_WORDS: Readonly<Record<SignalName, string>> = {
  proximity: 'proximity',
  'trace-match': 'trace match',
  novelty: 'novelty',
  churn: 'churn',
};

/** `proximity 0.35, trace match 0.30, novelty 0.25, churn 0.10`, in the fixed signal order. */
export function weightsText(weights: Readonly<Record<SignalName, number>>): string {
  return SIGNAL_ORDER.map((signal) => `${SIGNAL_WORDS[signal]} ${weights[signal].toFixed(2)}`).join(', ');
}

/** `up to 1 MiB and 10,000 events`. */
export function limitsText(limits: { readonly maxLogBytes: number; readonly maxEvents: number }): string {
  const mib = limits.maxLogBytes / 1_048_576;
  const size = Number.isInteger(mib) ? String(mib) : mib.toFixed(1);
  return `up to ${size} MiB and ${formatInteger(limits.maxEvents)} events`;
}

/** The first `maxLines` lines of `text`, without the trailing newline; '' gives an empty list. */
export function markdownExcerpt(text: string, maxLines: number): string[] {
  if (text === '') return [];
  const lines = text.split(/\r?\n/);
  if (lines[lines.length - 1] === '') lines.pop();
  return lines.slice(0, Math.max(0, maxLines));
}
