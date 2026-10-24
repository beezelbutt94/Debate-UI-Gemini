import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins truthy strings with a space', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
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

  it('handles all falsy values', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('handles single class', () => {
    expect(cn('only')).toBe('only');
  });

  it('handles empty call', () => {
    expect(cn()).toBe('');
  });

  it('handles empty string (filtered out by Boolean)', () => {
    expect(cn('a', '', 'b')).toBe('a b');
  });

  it('preserves class order', () => {
    expect(cn('first', 'second', 'third')).toBe('first second third');
  });

  it('handles whitespace-containing strings as-is', () => {
    expect(cn('px-4 py-2', 'text-white')).toBe('px-4 py-2 text-white');
  });

  it('mixes truthy and falsy in various positions', () => {
    expect(cn(false, 'a', null, 'b', undefined, 'c')).toBe('a b c');
  });
});
