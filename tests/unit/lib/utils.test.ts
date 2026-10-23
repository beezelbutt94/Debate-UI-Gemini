import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins non-falsy class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
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

  it('returns empty string when all args are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns empty string with no args', () => {
    expect(cn()).toBe('');
  });

  it('handles a single class', () => {
    expect(cn('only')).toBe('only');
  });

  it('handles empty string (falsy — filtered out)', () => {
    expect(cn('a', '', 'b')).toBe('a b');
  });

  it('preserves whitespace inside a class token', () => {
    expect(cn('px-4 py-2', 'text-sm')).toBe('px-4 py-2 text-sm');
  });

  it('handles many classes', () => {
    expect(cn('a', 'b', 'c', 'd', 'e')).toBe('a b c d e');
  });

  it('handles conditional pattern (class or false)', () => {
    const active = true;
    const disabled = false;
    expect(cn('base', active && 'active', disabled && 'disabled')).toBe('base active');
  });
});
