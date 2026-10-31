import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins two truthy class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('filters out falsy values: false', () => {
    expect(cn('a', false, 'b')).toBe('a b');
  });

  it('filters out falsy values: null', () => {
    expect(cn('a', null, 'b')).toBe('a b');
  });

  it('filters out falsy values: undefined', () => {
    expect(cn('a', undefined, 'b')).toBe('a b');
  });

  it('returns empty string when all args are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('handles a single class', () => {
    expect(cn('only')).toBe('only');
  });

  it('preserves whitespace inside a class string', () => {
    expect(cn('px-2 py-1', 'text-sm')).toBe('px-2 py-1 text-sm');
  });

  it('handles mixed truthy and falsy values', () => {
    expect(cn('a', false, 'b', null, 'c', undefined)).toBe('a b c');
  });

  it('handles all-truthy values', () => {
    expect(cn('x', 'y', 'z')).toBe('x y z');
  });

  it('handles empty string (falsy) correctly', () => {
    // empty string is falsy, so it should be filtered
    // Note: TypeScript type only accepts string | false | null | undefined,
    // but empty string is a string — it IS falsy and filtered by Boolean
    expect(cn('a', '' as string, 'b')).toBe('a b');
  });

  it('returns correct type (string)', () => {
    const result = cn('foo');
    expect(typeof result).toBe('string');
  });

  it('preserves duplicate class names without deduplication', () => {
    expect(cn('a', 'a', 'a')).toBe('a a a');
  });

  it('handles a large number of classes', () => {
    const classes = Array.from({ length: 20 }, (_, i) => `class-${i}`);
    const result = cn(...classes);
    expect(result).toBe(classes.join(' '));
  });

  it('handles all-false values', () => {
    expect(cn(false, false, false)).toBe('');
  });

  it('handles alternating truthy and falsy', () => {
    expect(cn('a', false, null, 'b', undefined, 'c')).toBe('a b c');
  });

  it('handles single falsy value', () => {
    expect(cn(false)).toBe('');
  });

  it('handles class with numbers in the name', () => {
    expect(cn('mt-4', 'px-2', 'text-xl')).toBe('mt-4 px-2 text-xl');
  });

  it('result does not start or end with a space when no leading/trailing falsy', () => {
    const result = cn('a', 'b', 'c');
    expect(result).not.toMatch(/^\s/);
    expect(result).not.toMatch(/\s$/);
  });
});
