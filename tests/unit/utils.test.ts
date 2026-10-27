import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('returns empty string when called with no args', () => {
    expect(cn()).toBe('');
  });

  it('joins two truthy strings with a space', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('filters out false', () => {
    expect(cn('foo', false, 'bar')).toBe('foo bar');
  });

  it('filters out null', () => {
    expect(cn('foo', null, 'bar')).toBe('foo bar');
  });

  it('filters out undefined', () => {
    expect(cn('foo', undefined, 'bar')).toBe('foo bar');
  });

  it('handles a single truthy string', () => {
    expect(cn('only')).toBe('only');
  });

  it('handles all falsy values and returns empty string', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('handles empty string (falsy)', () => {
    // empty string is falsy — filter(Boolean) removes it
    expect(cn('', 'bar')).toBe('bar');
  });

  it('handles many classes', () => {
    expect(cn('a', 'b', 'c', 'd')).toBe('a b c d');
  });

  it('preserves class strings with spaces in them', () => {
    expect(cn('px-4 py-2', 'text-sm')).toBe('px-4 py-2 text-sm');
  });

  it('conditional pattern: truthy condition', () => {
    const isActive = true;
    expect(cn('base', isActive && 'active')).toBe('base active');
  });

  it('conditional pattern: falsy condition', () => {
    const isActive = false;
    expect(cn('base', isActive && 'active')).toBe('base');
  });

  it('works with only undefined args', () => {
    expect(cn(undefined, undefined)).toBe('');
  });

  it('works with only null args', () => {
    expect(cn(null, null)).toBe('');
  });

  it('works with mixed truthy strings and null', () => {
    expect(cn(null, 'text-red-500', null, 'font-bold')).toBe('text-red-500 font-bold');
  });

  it('handles a single false arg', () => {
    expect(cn(false)).toBe('');
  });
});
