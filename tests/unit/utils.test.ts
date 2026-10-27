import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('returns single truthy string unchanged', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('joins multiple truthy strings with a space', () => {
    expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
  });

  it('filters out false values', () => {
    expect(cn('foo', false, 'bar')).toBe('foo bar');
  });

  it('filters out null values', () => {
    expect(cn('foo', null, 'bar')).toBe('foo bar');
  });

  it('filters out undefined values', () => {
    expect(cn('foo', undefined, 'bar')).toBe('foo bar');
  });

  it('handles all falsy values', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('handles leading/trailing falsy values', () => {
    expect(cn(null, 'only', undefined)).toBe('only');
  });

  it('preserves internal spaces within a class string', () => {
    expect(cn('hello world', 'foo')).toBe('hello world foo');
  });

  it('handles empty string argument (falsy) — filters it out', () => {
    // empty string is falsy, so it should be excluded
    const result = cn('a', '' as unknown as false, 'b');
    // empty string coerces to falsy; filter(Boolean) removes it
    expect(result).toBe('a b');
  });
});
