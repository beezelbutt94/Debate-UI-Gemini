import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('returns single class unchanged', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('joins multiple classes with a space', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('filters out null', () => {
    expect(cn('a', null, 'b')).toBe('a b');
  });

  it('filters out undefined', () => {
    expect(cn('a', undefined, 'b')).toBe('a b');
  });

  it('filters out false', () => {
    expect(cn('a', false, 'b')).toBe('a b');
  });

  it('filters out all falsy values together', () => {
    expect(cn(false, null, undefined, 'x', null, false)).toBe('x');
  });

  it('returns empty string when all values are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('preserves class names with spaces inside them', () => {
    expect(cn('hover:text-red-500', 'focus:outline-none')).toBe('hover:text-red-500 focus:outline-none');
  });

  it('handles conditional pattern correctly', () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base active');
  });
});
