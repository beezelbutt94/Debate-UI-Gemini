import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins truthy string classes', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('filters out falsy values', () => {
    expect(cn('foo', false, null, undefined, 'bar')).toBe('foo bar');
  });

  it('returns empty string when all falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('returns single class unchanged', () => {
    expect(cn('only')).toBe('only');
  });

  it('preserves class order', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('handles empty string argument as truthy (joins it)', () => {
    // empty string is falsy, so it should be filtered
    expect(cn('a', '', 'b')).toBe('a b');
  });

  it('handles many classes', () => {
    const result = cn('p-4', 'mt-2', 'text-white', 'bg-black', 'rounded');
    expect(result).toBe('p-4 mt-2 text-white bg-black rounded');
  });
});
