import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('returns a single class unchanged', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('joins multiple truthy classes with a space', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
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

  it('filters out all falsy at once', () => {
    expect(cn(false, null, undefined, 'x')).toBe('x');
  });

  it('returns empty string when all args are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('preserves class names with spaces inside them', () => {
    expect(cn('hover:text-blue-500', 'focus:ring-2')).toBe('hover:text-blue-500 focus:ring-2');
  });

  it('handles conditional pattern: class when condition is true', () => {
    const active = true;
    expect(cn('base', active && 'active')).toBe('base active');
  });

  it('handles conditional pattern: no class when condition is false', () => {
    const active = false;
    expect(cn('base', active && 'active')).toBe('base');
  });

  it('handles a single empty string argument', () => {
    // empty string is falsy-ish but filter(Boolean) removes it
    expect(cn('')).toBe('');
  });

  it('handles mix of non-empty and empty strings', () => {
    expect(cn('a', '', 'b')).toBe('a b');
  });

  it('handles duplicate class names (preserves both – not de-duped)', () => {
    expect(cn('a', 'a')).toBe('a a');
  });
});
