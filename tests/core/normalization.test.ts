import { describe, expect, it } from 'vitest';
import { normalizeRepositoryPath, normalizeTimestampUtc, canonicalWhitespace, stableSourceId } from '../../src/core/normalization';

describe('core normalization', () => {
  it('normalizes explicit offsets to UTC and rejects implicit local time', () => {
    expect(normalizeTimestampUtc('2026-10-19T09:50:00+05:30')).toBe('2026-10-19T04:20:00.000Z');
    expect(normalizeTimestampUtc('2026-10-19T09:50:00Z')).toBe('2026-10-19T09:50:00.000Z');
    expect(() => normalizeTimestampUtc('2026-10-19T09:50:00')).toThrow();
    expect(() => normalizeTimestampUtc('2026-02-30T09:50:00Z')).toThrow();
  });

  it('canonicalizes whitespace and repository-relative paths', () => {
    expect(canonicalWhitespace('  one\n\t two  ')).toBe('one two');
    expect(normalizeRepositoryPath('.\\src\\app.ts')).toBe('src/app.ts');
    expect(() => normalizeRepositoryPath('/src/app.ts')).toThrow();
    expect(() => normalizeRepositoryPath('src/../app.ts')).toThrow();
  });

  it('creates stable IDs from canonical content', () => {
    expect(stableSourceId({ b: 2, a: 1 })).toBe(stableSourceId({ a: 1, b: 2 }));
    expect(stableSourceId('same')).not.toBe(stableSourceId('different'));
  });
});
