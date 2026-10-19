import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins truthy class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('filters out falsy values', () => {
    expect(cn('foo', false, null, undefined, 'bar')).toBe('foo bar');
  });

  it('returns empty string when all args are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns empty string with no args', () => {
    expect(cn()).toBe('');
  });

  it('handles a single truthy class', () => {
    expect(cn('only')).toBe('only');
  });

  it('handles a single falsy value', () => {
    expect(cn(false)).toBe('');
  });

  it('preserves classes with spaces inside them', () => {
    // cn does not split individual strings -- it just joins them
    expect(cn('bg-red-500', 'text-white')).toBe('bg-red-500 text-white');
  });

  it('handles mixed truthy and falsy in any order', () => {
    expect(cn(null, 'a', undefined, false, 'b', null)).toBe('a b');
  });

  it('handles empty string (falsy)', () => {
    // empty string is falsy so it is filtered out
    const result = cn('' as unknown as false, 'real');
    expect(result).toBe('real');
  });

  it('handles tailwind class with colon (dark mode prefix)', () => {
    expect(cn('dark:bg-gray-800', 'text-white')).toBe('dark:bg-gray-800 text-white');
  });

  it('handles responsive prefix classes', () => {
    expect(cn('md:flex', 'lg:grid')).toBe('md:flex lg:grid');
  });

  it('handles many classes at once', () => {
    const result = cn('a', 'b', 'c', 'd', 'e', 'f');
    expect(result).toBe('a b c d e f');
  });

  it('handles alternating falsy and truthy values', () => {
    expect(cn(null, 'a', false, 'b', undefined, 'c', null)).toBe('a b c');
  });

  it('does not add extra spaces between classes', () => {
    expect(cn('foo', 'bar')).not.toMatch(/\s{2,}/);
  });
});
