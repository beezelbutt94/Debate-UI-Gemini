import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins two truthy classes', () => {
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

  it('returns empty string when all values are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('handles a single class', () => {
    expect(cn('only')).toBe('only');
  });

  it('handles many classes', () => {
    expect(cn('a', 'b', 'c', 'd', 'e')).toBe('a b c d e');
  });

  it('preserves class with spaces inside', () => {
    expect(cn('text-red-500', 'font-bold')).toBe('text-red-500 font-bold');
  });

  it('mixed truthy and falsy', () => {
    expect(cn('a', false, null, undefined, 'b', false, 'c')).toBe('a b c');
  });

  it('empty string is filtered out (falsy)', () => {
    // An empty string is falsy in JS, so filter(Boolean) removes it
    expect(cn('', 'b')).toBe('b');
  });
});
