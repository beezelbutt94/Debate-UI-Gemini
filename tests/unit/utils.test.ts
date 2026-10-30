import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins non-empty strings with a space', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('returns a single class unchanged', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('returns an empty string when called with no arguments', () => {
    expect(cn()).toBe('');
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

  it('filters out all falsy values mixed together', () => {
    expect(cn(false, null, undefined, 'x', false, null)).toBe('x');
  });

  it('returns empty string when all values are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('preserves Tailwind classes with colons and brackets', () => {
    expect(cn('hover:bg-blue-500', 'dark:text-white', 'lg:flex')).toBe(
      'hover:bg-blue-500 dark:text-white lg:flex'
    );
  });

  it('handles empty strings (falsy, gets filtered)', () => {
    // Empty string is falsy, so it should be filtered by Boolean
    expect(cn('a', '' as unknown as false, 'b')).toBe('a b');
  });

  it('handles a large number of classes', () => {
    const classes = Array.from({ length: 20 }, (_, i) => `cls-${i}`);
    expect(cn(...classes)).toBe(classes.join(' '));
  });

  it('handles classes with extra whitespace in the string itself', () => {
    // cn doesn't trim internal whitespace — it just joins what it gets
    expect(cn('a  b', 'c')).toBe('a  b c');
  });
});
