import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('returns empty string with no args', () => {
    expect(cn()).toBe('');
  });

  it('returns a single class unchanged', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('joins multiple classes with a space', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
    expect(cn('a', 'b', 'c')).toBe('a b c');
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

  it('filters out all falsy values together', () => {
    expect(cn(false, null, undefined, 'valid')).toBe('valid');
  });

  it('returns empty string when all values are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('preserves class names that contain spaces', () => {
    expect(cn('foo bar', 'baz')).toBe('foo bar baz');
  });

  it('handles a single empty string', () => {
    // empty string is falsy, so it gets filtered
    expect(cn('')).toBe('');
  });

  it('handles many classes', () => {
    expect(cn('a', 'b', 'c', 'd', 'e')).toBe('a b c d e');
  });
});
