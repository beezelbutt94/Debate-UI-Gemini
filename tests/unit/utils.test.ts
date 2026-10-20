import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins truthy string values', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
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

  it('returns empty string with no args', () => {
    expect(cn()).toBe('');
  });

  it('handles a single class', () => {
    expect(cn('only')).toBe('only');
  });

  it('handles many classes', () => {
    expect(cn('a', 'b', 'c', 'd', 'e')).toBe('a b c d e');
  });

  it('keeps empty strings (they are falsy-filter-pass in Boolean? no — empty string is falsy)', () => {
    // empty string is falsy so it should be filtered out
    // actually '' is falsy, filter(Boolean) removes it
    expect(cn('a', '' as unknown as false, 'b')).toBe('a b');
  });

  it('preserves class names with spaces inside (no splitting)', () => {
    expect(cn('px-2 py-4', 'text-red-500')).toBe('px-2 py-4 text-red-500');
  });

  it('conditional pattern: truthy condition adds class', () => {
    const active = true;
    expect(cn('base', active && 'active')).toBe('base active');
  });

  it('conditional pattern: falsy condition omits class', () => {
    const active = false;
    expect(cn('base', active && 'active')).toBe('base');
  });
});
