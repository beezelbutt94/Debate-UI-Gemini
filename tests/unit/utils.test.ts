import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins two truthy class strings', () => {
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

  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('handles a single truthy class', () => {
    expect(cn('only')).toBe('only');
  });

  it('handles multiple falsy values between strings', () => {
    expect(cn('a', false, null, undefined, 'b', false, 'c')).toBe('a b c');
  });

  it('handles empty string as falsy-ish (empty strings pass filter(Boolean))', () => {
    // empty string is falsy — filter(Boolean) removes it
    expect(cn('a', '', 'b')).toBe('a b');
  });

  it('preserves class names with spaces inside', () => {
    expect(cn('text-red-500', 'font-bold')).toBe('text-red-500 font-bold');
  });

  it('works with many classes', () => {
    const result = cn('a', 'b', 'c', 'd', 'e');
    expect(result).toBe('a b c d e');
  });

  it('returns a string type', () => {
    expect(typeof cn('x')).toBe('string');
  });
});
