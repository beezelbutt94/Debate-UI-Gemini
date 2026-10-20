import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins truthy strings with a space', () => {
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

  it('returns empty string when all args are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns empty string with no args', () => {
    expect(cn()).toBe('');
  });

  it('handles a single class', () => {
    expect(cn('only')).toBe('only');
  });

  it('filters mixed falsy in the middle', () => {
    expect(cn('a', null, 'b', false, 'c', undefined)).toBe('a b c');
  });

  it('preserves a class with spaces inside it', () => {
    // cn does not split strings; it joins them as-is
    expect(cn('p-4 m-2', 'text-center')).toBe('p-4 m-2 text-center');
  });

  it('handles empty string (falsy) by filtering it out', () => {
    // empty string is falsy in JS, filter(Boolean) removes it
    expect(cn('a', '', 'b')).toBe('a b');
  });

  it('all arguments truthy, no filtering needed', () => {
    expect(cn('x', 'y', 'z')).toBe('x y z');
  });
});
