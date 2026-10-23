import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins multiple truthy class strings', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('filters out falsy values: false', () => {
    expect(cn('a', false, 'c')).toBe('a c');
  });

  it('filters out falsy values: null', () => {
    expect(cn('a', null, 'c')).toBe('a c');
  });

  it('filters out falsy values: undefined', () => {
    expect(cn('a', undefined, 'c')).toBe('a c');
  });

  it('returns empty string when all values are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('returns single class unchanged', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('handles empty string (falsy) by filtering it out', () => {
    // empty string is falsy, so it gets filtered
    expect(cn('a', '' as unknown as false, 'b')).toBe('a b');
  });

  it('preserves class names with spaces (does not split them)', () => {
    expect(cn('foo bar', 'baz')).toBe('foo bar baz');
  });

  it('handles a mix of truthy and falsy in long lists', () => {
    expect(cn('x', false, null, 'y', undefined, 'z')).toBe('x y z');
  });

  it('only one truthy class', () => {
    expect(cn(false, null, 'only')).toBe('only');
  });
});
