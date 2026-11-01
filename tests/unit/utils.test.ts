import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('returns empty string for no args', () => {
    expect(cn()).toBe('');
  });

  it('joins truthy string values with a space', () => {
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

  it('handles all falsy args', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('handles a single class', () => {
    expect(cn('hello')).toBe('hello');
  });

  it('handles mixed truthy/falsy in any order', () => {
    expect(cn(null, 'x', false, undefined, 'y', null)).toBe('x y');
  });

  it('preserves internal whitespace in individual class strings', () => {
    expect(cn('foo bar', 'baz')).toBe('foo bar baz');
  });

  it('handles empty string as falsy (filtered out by Boolean)', () => {
    // Empty string is falsy, so Boolean('') === false — it gets filtered
    expect(cn('a', '', 'b')).toBe('a b');
  });

  it('handles many classes', () => {
    const result = cn('a', 'b', 'c', 'd', 'e');
    expect(result).toBe('a b c d e');
  });

  it('handles only one truthy among many falsy', () => {
    expect(cn(false, null, undefined, 'only', false)).toBe('only');
  });
});
