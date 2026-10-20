import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins two truthy strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('joins many truthy strings', () => {
    expect(cn('a', 'b', 'c', 'd')).toBe('a b c d');
  });

  it('returns single class unchanged', () => {
    expect(cn('only')).toBe('only');
  });

  it('returns empty string when called with no args', () => {
    expect(cn()).toBe('');
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

  it('filters out all falsy values simultaneously', () => {
    expect(cn(false, null, undefined, 'real')).toBe('real');
  });

  it('returns empty string when all values are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('handles empty string passed as an argument (treated as falsy by filter)', () => {
    // Empty string is falsy in JS, so filter(Boolean) drops it.
    expect(cn('a', '' as unknown as string, 'b')).toBe('a b');
  });

  it('handles conditional class pattern', () => {
    const isActive = true;
    expect(cn('btn', isActive && 'btn-active')).toBe('btn btn-active');
  });

  it('handles conditional class pattern when condition is false', () => {
    const isActive = false;
    expect(cn('btn', isActive && 'btn-active')).toBe('btn');
  });

  it('preserves class string with embedded spaces as-is', () => {
    expect(cn('px-4 py-2', 'text-white')).toBe('px-4 py-2 text-white');
  });

  it('handles a single falsy argument', () => {
    expect(cn(false)).toBe('');
  });
});
