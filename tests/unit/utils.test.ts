import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins two class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles a single class', () => {
    expect(cn('only')).toBe('only');
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
    expect(cn(false, null, undefined, 'real')).toBe('real');
  });

  it('returns empty string for all falsy inputs', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns empty string for no arguments', () => {
    expect(cn()).toBe('');
  });

  it('preserves multiple spaces inside a class string', () => {
    // cn joins with a single space; it does not normalize internal spaces
    expect(cn('a  b', 'c')).toBe('a  b c');
  });

  it('handles class names with special characters', () => {
    expect(cn('text-[#ff0000]', 'hover:scale-105')).toBe('text-[#ff0000] hover:scale-105');
  });

  it('handles conditional class patterns (truthy string)', () => {
    const isActive = true;
    expect(cn('base', isActive && 'active')).toBe('base active');
  });

  it('handles conditional class patterns (falsy — false)', () => {
    const isActive = false;
    expect(cn('base', isActive && 'active')).toBe('base');
  });

  it('joins many classes', () => {
    expect(cn('a', 'b', 'c', 'd', 'e')).toBe('a b c d e');
  });

  it('handles empty string arguments (keeps them, join behaviour)', () => {
    // empty string is falsy, so it gets filtered
    const result = cn('a', '' as unknown as false, 'b');
    // '' is falsy → filtered
    expect(result).toBe('a b');
  });
});
