import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('returns empty string for no arguments', () => {
    expect(cn()).toBe('');
  });

  it('returns a single class', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('joins multiple classes with a space', () => {
    expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
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

  it('filters all falsy values in one call', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('handles mixed truthy and falsy values', () => {
    expect(cn('a', false, 'b', null, 'c', undefined, 'd')).toBe('a b c d');
  });

  it('preserves internal spaces within a class string', () => {
    expect(cn('foo bar')).toBe('foo bar');
  });

  it('does not trim surrounding whitespace from individual strings', () => {
    expect(cn(' foo ', ' bar ')).toBe(' foo   bar ');
  });

  it('handles empty string (falsy — filtered out)', () => {
    expect(cn('', 'foo')).toBe('foo');
  });

  it('handles a single falsy argument', () => {
    expect(cn(false)).toBe('');
  });

  it('handles all empty strings', () => {
    expect(cn('', '', '')).toBe('');
  });

  it('handles class names with special characters', () => {
    expect(cn('hover:bg-blue-500', 'md:text-lg')).toBe('hover:bg-blue-500 md:text-lg');
  });

  it('handles many arguments', () => {
    const classes = Array.from({ length: 20 }, (_, i) => `class-${i}`);
    const result = cn(...classes);
    expect(result).toBe(classes.join(' '));
  });
});
