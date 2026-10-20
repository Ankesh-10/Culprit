/**
 * DOM-free helpers for the landing view. Everything here is a pure function of its arguments so the
 * page logic can be tested without a browser.
 */

/** Prefix every whitespace-separated id reference: 'a b' with prefix 'p' gives 'p-a p-b'. */
export function prefixIdRefs(value: string, prefix: string): string {
  return value
    .split(/\s+/)
    .filter((token) => token !== '')
    .map((token) => `${prefix}-${token}`)
    .join(' ');
}
