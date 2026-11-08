import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins two plain strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
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

  it('returns empty string when all values are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('handles a single truthy class', () => {
    expect(cn('only')).toBe('only');
  });

  it('handles mixed truthy and falsy values', () => {
    expect(cn('a', false, 'b', null, 'c', undefined)).toBe('a b c');
  });

  it('preserves whitespace inside class strings', () => {
    expect(cn('px-4 py-2', 'text-sm')).toBe('px-4 py-2 text-sm');
  });

  it('handles empty string (falsy — filtered out)', () => {
    expect(cn('a', '', 'b')).toBe('a b');
  });

  it('allows duplicate class names (no deduplication — raw join)', () => {
    expect(cn('text-red', 'text-red')).toBe('text-red text-red');
  });

  it('handles Tailwind utility classes with brackets and colons', () => {
    expect(cn('hover:bg-blue-500', 'focus:outline-none')).toBe('hover:bg-blue-500 focus:outline-none');
  });

  it('handles arbitrary number of truthy args', () => {
    const classes = Array.from({ length: 10 }, (_, i) => `class-${i}`);
    expect(cn(...(classes as [string, ...string[]]))).toBe(classes.join(' '));
  });

  it('handles mix of many truthy and falsy values', () => {
    expect(cn('a', null, 'b', false, 'c', undefined, 'd', null, 'e')).toBe('a b c d e');
  });

  it('handles all null/false/undefined — returns empty string', () => {
    expect(cn(null, false, undefined, null, false)).toBe('');
  });

  it('handles a class string with leading/trailing spaces (preserved — not trimmed)', () => {
    // cn doesn't trim individual class strings
    expect(cn('  spaced  ', 'normal')).toBe('  spaced   normal');
  });

  it('single false arg returns empty string', () => {
    expect(cn(false)).toBe('');
  });

  it('single null arg returns empty string', () => {
    expect(cn(null)).toBe('');
  });

  it('single undefined arg returns empty string', () => {
    expect(cn(undefined)).toBe('');
  });
});
