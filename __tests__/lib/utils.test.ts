import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins two truthy strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('returns a single class untouched', () => {
    expect(cn('only')).toBe('only');
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

  it('returns empty string when all args are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns empty string with no args', () => {
    expect(cn()).toBe('');
  });

  it('handles a mix of valid and invalid values', () => {
    expect(cn('a', false, 'b', null, 'c', undefined)).toBe('a b c');
  });

  it('handles empty strings (they are falsy after filter)', () => {
    // empty string is falsy so it gets filtered out
    // Actually '' is falsy in JS, so filter(Boolean) removes it
    expect(cn('a', '', 'b')).toBe('a b');
  });

  it('preserves whitespace inside individual class strings', () => {
    expect(cn('px-2 py-1', 'text-red-500')).toBe('px-2 py-1 text-red-500');
  });

  it('works with many classes', () => {
    const result = cn('a', 'b', 'c', 'd', 'e');
    expect(result).toBe('a b c d e');
  });
});
