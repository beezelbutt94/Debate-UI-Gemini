import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('returns a single class unchanged', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('joins multiple strings with spaces', () => {
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

  it('filters out all falsy types simultaneously', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });

  it('returns empty string when all arguments are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('handles empty string — treated as falsy and filtered', () => {
    // An empty string is falsy in JS so filter(Boolean) removes it
    expect(cn('a', '' as unknown as false, 'b')).toBe('a b');
  });

  it('preserves internal whitespace within a class string', () => {
    expect(cn('  a  ', 'b')).toBe('  a   b');
  });

  it('works with a single falsy argument', () => {
    expect(cn(false)).toBe('');
    expect(cn(null)).toBe('');
    expect(cn(undefined)).toBe('');
  });

  it('works with two valid class strings', () => {
    expect(cn('text-red-500', 'font-bold')).toBe('text-red-500 font-bold');
  });

  it('handles long list of mixed values', () => {
    expect(cn('a', null, 'b', false, undefined, 'c', null, 'd')).toBe('a b c d');
  });
});
