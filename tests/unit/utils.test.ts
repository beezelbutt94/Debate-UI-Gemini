import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins two class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('returns a single class unchanged', () => {
    expect(cn('only')).toBe('only');
  });

  it('filters out falsy values: false', () => {
    expect(cn('a', false, 'b')).toBe('a b');
  });

  it('filters out falsy values: null', () => {
    expect(cn('a', null, 'b')).toBe('a b');
  });

  it('filters out falsy values: undefined', () => {
    expect(cn('a', undefined, 'b')).toBe('a b');
  });

  it('returns empty string when all args are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('handles multiple classes with spaces preserved', () => {
    expect(cn('px-4', 'py-2', 'text-white')).toBe('px-4 py-2 text-white');
  });

  it('handles empty string (falsy) values by including them since empty string is falsy → filtered', () => {
    // empty string is falsy, so it should be filtered
    const result = cn('a', '' as unknown as false, 'b');
    // empty string filters out
    expect(result).toBe('a b');
  });

  it('works with only one truthy arg and rest falsy', () => {
    expect(cn(false, null, 'x', undefined)).toBe('x');
  });

  it('handles class strings with internal spaces', () => {
    expect(cn('flex items-center', 'justify-between')).toBe('flex items-center justify-between');
  });

  it('handles all-false input', () => {
    expect(cn(false, false, false)).toBe('');
  });

  it('join order matches argument order', () => {
    expect(cn('first', 'second', 'third')).toBe('first second third');
  });
});
