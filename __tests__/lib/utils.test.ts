import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins non-empty strings with a space', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('returns a single string unchanged', () => {
    expect(cn('foo')).toBe('foo');
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

  it('returns empty string when all args are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns empty string with no args', () => {
    expect(cn()).toBe('');
  });

  it('handles Tailwind-style conditional classes', () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base active');
  });

  it('handles empty string as falsy', () => {
    // empty string is falsy, so it gets filtered
    expect(cn('a', '' as string, 'b')).toBe('a b');
  });

  it('preserves internal whitespace in individual class strings', () => {
    expect(cn('px-4 py-2', 'mt-1')).toBe('px-4 py-2 mt-1');
  });

  it('handles all-true conditional block', () => {
    expect(cn(true && 'a', true && 'b')).toBe('a b');
  });

  it('handles many falsy values in a row', () => {
    expect(cn(false, false, false, 'only', false, false)).toBe('only');
  });
});
