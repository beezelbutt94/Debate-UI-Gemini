import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins truthy string classes', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('filters out false values', () => {
    expect(cn('a', false, 'b')).toBe('a b');
  });

  it('filters out null values', () => {
    expect(cn('a', null, 'b')).toBe('a b');
  });

  it('filters out undefined values', () => {
    expect(cn('a', undefined, 'b')).toBe('a b');
  });

  it('returns empty string when all values are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('handles a single class', () => {
    expect(cn('btn')).toBe('btn');
  });

  it('handles a mix of truthy and falsy values', () => {
    expect(cn('px-4', false, null, 'text-white', undefined, 'rounded')).toBe('px-4 text-white rounded');
  });

  it('preserves class with spaces (passes through as-is)', () => {
    expect(cn('foo bar')).toBe('foo bar');
  });

  it('handles empty string as falsy-like (empty string is falsy, filtered out)', () => {
    // empty string is falsy — filter(Boolean) removes it
    const emptyStr = '' as unknown as false;
    expect(cn('a', emptyStr, 'b')).toBe('a b');
  });
});
