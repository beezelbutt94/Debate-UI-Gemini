import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('returns empty string when called with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('returns single class unchanged', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('joins multiple truthy strings with spaces', () => {
    expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
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

  it('filters out all falsy values in a mixed list', () => {
    expect(cn(null, false, undefined, 'active', null, 'bold')).toBe('active bold');
  });

  it('returns empty string when all values are falsy', () => {
    expect(cn(null, false, undefined)).toBe('');
  });

  it('handles a single falsy value', () => {
    expect(cn(false)).toBe('');
  });

  it('preserves existing whitespace inside class names', () => {
    // the function joins with a space; internal spaces in strings pass through
    expect(cn('foo bar', 'baz')).toBe('foo bar baz');
  });
});
