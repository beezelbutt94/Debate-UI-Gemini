import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins multiple truthy strings', () => {
    expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
  });

  it('filters out falsy values: false', () => {
    expect(cn('a', false, 'b')).toBe('a b');
  });

  it('filters out null', () => {
    expect(cn('a', null, 'b')).toBe('a b');
  });

  it('filters out undefined', () => {
    expect(cn('a', undefined, 'b')).toBe('a b');
  });

  it('filters out empty string (falsy)', () => {
    expect(cn('a', '', 'b')).toBe('a b');
  });

  it('returns empty string when all falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('handles a single truthy class', () => {
    expect(cn('only')).toBe('only');
  });

  it('handles conditional pattern: true branch selected', () => {
    const active = true;
    expect(cn('base', active && 'active')).toBe('base active');
  });

  it('handles conditional pattern: false branch filtered', () => {
    const active = false;
    expect(cn('base', active && 'active')).toBe('base');
  });

  it('returns empty string for no arguments', () => {
    expect(cn()).toBe('');
  });

  it('preserves class names with spaces inside them', () => {
    // This is by design — cn joins with a space separator;
    // internal spaces in a class string are the caller's concern.
    expect(cn('foo bar')).toBe('foo bar');
  });

  it('handles many mixed arguments', () => {
    expect(cn('a', false, 'b', null, 'c', undefined, 'd')).toBe('a b c d');
  });
});
