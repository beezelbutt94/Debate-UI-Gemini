import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins non-empty strings', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('filters out falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });

  it('returns empty string when all falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns empty string with no args', () => {
    expect(cn()).toBe('');
  });

  it('handles single class', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('handles all truthy', () => {
    expect(cn('x', 'y')).toBe('x y');
  });

  it('handles empty string (falsy)', () => {
    // empty string is falsy — filtered out
    expect(cn('a', '' as unknown as false, 'b')).toBe('a b');
  });

  it('preserves class with spaces inside', () => {
    expect(cn('text-red-500', 'font-bold')).toBe('text-red-500 font-bold');
  });

  it('handles undefined mixed with valid strings', () => {
    expect(cn(undefined, 'base', undefined)).toBe('base');
  });

  it('handles all null values', () => {
    expect(cn(null, null)).toBe('');
  });
});
