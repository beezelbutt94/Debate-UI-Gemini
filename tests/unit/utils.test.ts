import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins two truthy strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('joins multiple truthy strings', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('filters out false', () => {
    expect(cn('a', false, 'b')).toBe('a b');
  });

  it('filters out null', () => {
    expect(cn('a', null, 'b')).toBe('a b');
  });

  it('filters out undefined', () => {
    expect(cn('a', undefined, 'b')).toBe('a b');
  });

  it('returns empty string when all values are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('returns single class with one argument', () => {
    expect(cn('only')).toBe('only');
  });

  it('preserves class names with hyphens', () => {
    expect(cn('text-red-500', 'bg-white')).toBe('text-red-500 bg-white');
  });

  it('handles empty string argument (filtered out via Boolean cast)', () => {
    // empty string is falsy, so it should be filtered
    expect(cn('a', '' as never, 'b')).toBe('a b');
  });

  it('handles mixed valid and falsy values in a long list', () => {
    expect(cn('x', null, 'y', undefined, false, 'z')).toBe('x y z');
  });
});
