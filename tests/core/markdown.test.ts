import { describe, expect, it } from 'vitest';
import { escapeMarkdown, inlineCode } from '../../src/core/markdown';

describe('escapeMarkdown', () => {
  it('escapes heading, link, and HTML syntax', () => {
    expect(escapeMarkdown('# heading')).toBe('\\# heading');
    expect(escapeMarkdown('[x](javascript:alert(1))')).toBe('\\[x\\](javascript:alert(1))');
    expect(escapeMarkdown('<script>')).toBe('\\<script\\>');
  });

  it('collapses newlines, tabs, and runs of spaces to a single space', () => {
    expect(escapeMarkdown('a\nb\t c')).toBe('a b c');
    expect(escapeMarkdown('  a\r\n\r\n# b  ')).toBe('a \\# b');
  });

  it('escapes emphasis, strikethrough, table, code, and escape characters', () => {
    expect(escapeMarkdown('*a*')).toBe('\\*a\\*');
    expect(escapeMarkdown('_a_')).toBe('\\_a\\_');
    expect(escapeMarkdown('~~a~~')).toBe('\\~\\~a\\~\\~');
    expect(escapeMarkdown('a|b')).toBe('a\\|b');
    expect(escapeMarkdown('`a`')).toBe('\\`a\\`');
    expect(escapeMarkdown('a\\b')).toBe('a\\\\b');
  });

  it('leaves ordinary prose punctuation untouched', () => {
    const prose = 'Strong trace evidence, but correlation is not causality.';
    expect(escapeMarkdown(prose)).toBe(prose);
    expect(escapeMarkdown('refactor: add payment provider retry path (v2) - "ok"')).toBe('refactor: add payment provider retry path (v2) - "ok"');
  });
});

describe('inlineCode', () => {
  it('uses a single-backtick span for plain text', () => {
    expect(inlineCode('src/a.ts')).toBe('`src/a.ts`');
  });

  it('uses a fence longer than any backtick run inside the text', () => {
    expect(inlineCode('a`b')).toBe('``a`b``');
    expect(inlineCode('a``b')).toBe('```a``b```');
  });

  it('pads with spaces when the text starts or ends with a backtick', () => {
    expect(inlineCode('`x')).toBe('`` `x ``');
    expect(inlineCode('x`')).toBe('`` x` ``');
  });

  it('collapses newlines so a span cannot start a new line', () => {
    expect(inlineCode('a\n# b')).toBe('`a # b`');
  });
});
