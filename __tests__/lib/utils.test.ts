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

  it('handles a large number of truthy arguments', () => {
    const classes = Array.from({ length: 100 }, (_, i) => `cls-${i}`);
    const result = cn(...classes);
    expect(result).toBe(classes.join(' '));
  });

  it('handles a large number of mixed arguments', () => {
    const result = cn('a', null, 'b', false, 'c', undefined, 'd');
    expect(result).toBe('a b c d');
  });

  it('handles duplicate class names without deduplication', () => {
    expect(cn('foo', 'foo', 'bar')).toBe('foo foo bar');
  });

  it('handles empty string class (empty string is falsy, filtered out)', () => {
    expect(cn('foo', '', 'bar')).toBe('foo bar');
  });
});
