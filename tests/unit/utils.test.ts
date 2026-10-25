import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins truthy string classes', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
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

  it('returns empty string when all falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('handles single class', () => {
    expect(cn('only')).toBe('only');
  });

  it('handles mixed truthy and falsy in various positions', () => {
    expect(cn(false, 'a', null, 'b', undefined, 'c')).toBe('a b c');
  });

  it('handles empty string (falsy, but filtered)', () => {
    // empty string is falsy — it should be filtered out
    expect(cn('a', '' as unknown as false, 'b')).toBe('a b');
  });

  it('preserves class with spaces inside', () => {
    expect(cn('foo bar', 'baz')).toBe('foo bar baz');
  });

  it('handles all-false array', () => {
    expect(cn(false, false, false)).toBe('');
  });

  it('handles long list of valid classes', () => {
    const classes = Array.from({ length: 20 }, (_, i) => `class-${i}`);
    const result = cn(...(classes as Array<string>));
    expect(result).toBe(classes.join(' '));
  });

  it('handles duplicate classes (passes through without dedup)', () => {
    expect(cn('foo', 'foo')).toBe('foo foo');
  });
});
