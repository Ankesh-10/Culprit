/**
 * Small, dependency-free helpers that make supplied text safe to interpolate into the
 * Markdown postmortem. Both collapse every whitespace run (newlines and tabs included)
 * to one space, so a supplied string can never start a new Markdown line or heading.
 */

function flatten(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Escape text for use as inline prose. Backslash, backtick, asterisk, underscore, square
 * brackets, angle brackets, hash, tilde and pipe get a leading backslash. Period, comma,
 * colon, hyphen, parentheses and quotes are left alone so ordinary sentences read normally.
 */
export function escapeMarkdown(text: string): string {
  return flatten(text).replace(/[\\`*_[\]<>#~|]/g, '\\$&');
}

/**
 * Wrap text in an inline code span whose fence is longer than any backtick run inside it.
 * A space is added inside the fence when the text starts or ends with a backtick.
 */
export function inlineCode(text: string): string {
  const flat = flatten(text);
  let longest = 0;
  for (const run of flat.match(/`+/g) ?? []) {
    if (run.length > longest) longest = run.length;
  }
  const fence = '`'.repeat(longest + 1);
  const padded = flat.startsWith('`') || flat.endsWith('`') ? ` ${flat} ` : flat;
  return `${fence}${padded}${fence}`;
}
