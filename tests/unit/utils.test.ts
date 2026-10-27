import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('returns empty string with no args', () => {
    expect(cn()).toBe('');
  });

  it('joins truthy strings with spaces', () => {
    expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
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

  it('handles all falsy values', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('handles single truthy value', () => {
    expect(cn('only')).toBe('only');
  });

  it('preserves internal spaces in class strings', () => {
    expect(cn('px-4 py-2', 'text-lg')).toBe('px-4 py-2 text-lg');
  });

  it('handles mix of truthy and falsy', () => {
    expect(cn('a', false, null, 'b', undefined, 'c')).toBe('a b c');
  });

  it('handles conditional class pattern', () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base active');
  });

  it('handles empty string (falsy — filtered out)', () => {
    // empty string is falsy so filter(Boolean) drops it
    expect(cn('a', '' as string, 'b')).toBe('a b');
  });

  it('handles many classes', () => {
    const result = cn('a', 'b', 'c', 'd', 'e', 'f');
    expect(result).toBe('a b c d e f');
  });
});
