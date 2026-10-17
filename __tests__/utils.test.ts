import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('returns empty string when called with no args', () => {
    expect(cn()).toBe('');
  });

  it('returns a single class', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('joins multiple classes with a space', () => {
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

  it('filters out all falsy values together', () => {
    expect(cn(false, null, undefined, 'real')).toBe('real');
  });

  it('returns empty string when all args are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('does not filter empty string (falsy but valid spacing concern) — note: Boolean("") is false so it IS filtered', () => {
    // empty string is falsy, so filter(Boolean) removes it
    expect(cn('', 'foo')).toBe('foo');
  });

  it('handles a realistic conditional class pattern', () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn('btn', isActive && 'btn-active', isDisabled && 'btn-disabled')).toBe('btn btn-active');
  });

  it('preserves class order', () => {
    expect(cn('c', 'b', 'a')).toBe('c b a');
  });

  it('handles all-truthy strings', () => {
    expect(cn('a', 'b', 'c', 'd', 'e')).toBe('a b c d e');
  });

  it('handles a single falsy arg', () => {
    expect(cn(false)).toBe('');
    expect(cn(null)).toBe('');
    expect(cn(undefined)).toBe('');
  });

  it('preserves class names with hyphens and slashes (Tailwind utilities)', () => {
    expect(cn('text-sm', 'bg-blue-500', 'hover:text-white', 'md:flex')).toBe(
      'text-sm bg-blue-500 hover:text-white md:flex'
    );
  });
});
