import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('returns empty string for no arguments', () => {
    expect(cn()).toBe('');
  });

  it('returns a single truthy string', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('joins multiple truthy strings with a space', () => {
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

  it('filters out all falsy values together', () => {
    expect(cn(false, null, undefined, 'hello')).toBe('hello');
  });

  it('returns empty string when all values are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('handles conditional class pattern used in tailwind', () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base active');
  });

  it('preserves class names with spaces (e.g. compound tailwind classes)', () => {
    expect(cn('flex items-center', 'gap-2')).toBe('flex items-center gap-2');
  });

  it('handles empty string as truthy (joined but contributes empty segment)', () => {
    // empty string is falsy in JS so filter(Boolean) removes it
    expect(cn('a', '', 'b')).toBe('a b');
  });

  it('handles single false value', () => {
    expect(cn(false)).toBe('');
  });

  it('handles single null value', () => {
    expect(cn(null)).toBe('');
  });

  it('handles single undefined value', () => {
    expect(cn(undefined)).toBe('');
  });

  it('works with many classes', () => {
    const result = cn('a', 'b', 'c', 'd', 'e', 'f');
    expect(result).toBe('a b c d e f');
  });
});
