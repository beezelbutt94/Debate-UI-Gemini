import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('returns empty string when called with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('returns single truthy string', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('joins multiple truthy strings with a space', () => {
    expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
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

  it('filters out all falsy values', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('works with conditional class patterns', () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn('btn', isActive && 'btn-active', isDisabled && 'btn-disabled')).toBe('btn btn-active');
  });

  it('preserves class names with hyphens and colons (Tailwind variants)', () => {
    expect(cn('hover:bg-blue-500', 'md:flex')).toBe('hover:bg-blue-500 md:flex');
  });

  it('handles empty strings (treats as falsy-like but still passes filter)', () => {
    // empty string is falsy — filter(Boolean) removes it
    expect(cn('foo', '' as unknown as false, 'bar')).toBe('foo bar');
  });

  it('single falsy argument yields empty string', () => {
    expect(cn(false)).toBe('');
  });

  it('correctly handles all falsy types mixed with valid classes', () => {
    expect(cn('a', false, null, undefined, 'b', false, 'c')).toBe('a b c');
  });

  it('handles a single class with trailing space in name (preserves literally)', () => {
    expect(cn('foo ')).toBe('foo ');
  });
});
