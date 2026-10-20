import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins non-empty strings', () => {
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

  it('returns empty string when all falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('handles single class', () => {
    expect(cn('only')).toBe('only');
  });

  it('handles mix of truthy and falsy values', () => {
    expect(cn('px-2', false, 'py-1', null, undefined, 'text-sm')).toBe('px-2 py-1 text-sm');
  });

  it('preserves class names with spaces inside (treats as opaque strings)', () => {
    expect(cn('foo bar', 'baz')).toBe('foo bar baz');
  });

  it('handles empty string as falsy-like but still joins (empty string is falsy)', () => {
    // Empty string is falsy and gets filtered out
    const result = cn('a', '' as unknown as false, 'b');
    expect(result).toBe('a b');
  });

  it('works with conditional Tailwind patterns', () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn('base-class', isActive && 'active', isDisabled && 'disabled')).toBe('base-class active');
  });
});
