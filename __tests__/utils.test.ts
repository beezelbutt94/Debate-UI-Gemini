import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins two truthy strings', () => {
    expect(cn('a', 'b')).toBe('a b');
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

  it('filters out all falsy values together', () => {
    expect(cn(false, null, undefined, 'x')).toBe('x');
  });

  it('returns empty string when all args are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('handles a single truthy string', () => {
    expect(cn('only')).toBe('only');
  });

  it('handles many truthy strings', () => {
    expect(cn('a', 'b', 'c', 'd')).toBe('a b c d');
  });

  it('preserves internal spaces in a class string', () => {
    expect(cn('foo bar', 'baz')).toBe('foo bar baz');
  });

  it('handles empty string as falsy-ish (empty string is falsy)', () => {
    // empty string is falsy — cn should filter it out
    expect(cn('', 'real')).toBe('real');
  });

  it('handles string with only spaces (truthy, kept)', () => {
    expect(cn('  ', 'real')).toBe('   real');
  });
});
