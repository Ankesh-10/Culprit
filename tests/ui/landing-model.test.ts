import { describe, expect, it } from 'vitest';
import { prefixIdRefs } from '../../src/ui/landing-model';

describe('prefixIdRefs', () => {
  it('prefixes every token', () => {
    expect(prefixIdRefs('a b', 'p')).toBe('p-a p-b');
  });

  it('collapses surrounding and repeated whitespace', () => {
    expect(prefixIdRefs('  a   b\tc\n', 'p')).toBe('p-a p-b p-c');
  });

  it('gives an empty string for empty and whitespace-only input', () => {
    expect(prefixIdRefs('', 'p')).toBe('');
    expect(prefixIdRefs('   \n ', 'p')).toBe('');
  });
});
