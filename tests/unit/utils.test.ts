import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('returns empty string when no args', () => {
    expect(cn()).toBe('');
  });

  it('returns single class', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('joins multiple classes with spaces', () => {
    expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
  });

  it('filters out falsy values', () => {
    expect(cn('a', false, 'b', null, undefined, 'c')).toBe('a b c');
  });

  it('filters all falsy — returns empty string', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('single truthy class with surrounding falsy', () => {
    expect(cn(null, 'only', false)).toBe('only');
  });

  it('preserves class names with spaces in them', () => {
    expect(cn('hover:bg-red-500', 'text-lg')).toBe('hover:bg-red-500 text-lg');
  });

  it('empty string is treated as falsy and filtered out', () => {
    expect(cn('a', '', 'b')).toBe('a b');
  });

  it('true is not an accepted value type — only false is', () => {
    // The type signature only allows string | false | null | undefined
    // Passing false is explicitly allowed
    expect(cn(false)).toBe('');
  });

  it('large number of classes all included', () => {
    const classes = Array.from({ length: 20 }, (_, i) => `class-${i}`);
    const result = cn(...classes);
    expect(result.split(' ').length).toBe(20);
    expect(result).toContain('class-0');
    expect(result).toContain('class-19');
  });

  it('single falsy between two truthy classes', () => {
    expect(cn('a', null, 'b')).toBe('a b');
    expect(cn('a', undefined, 'b')).toBe('a b');
    expect(cn('a', false, 'b')).toBe('a b');
  });

  it('order of classes is preserved', () => {
    expect(cn('z', 'a', 'm')).toBe('z a m');
  });
});
