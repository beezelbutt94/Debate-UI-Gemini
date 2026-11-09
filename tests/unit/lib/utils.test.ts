import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('returns empty string when called with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('returns a single class unchanged', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('joins multiple classes with a space', () => {
    expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
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

  it('returns empty string when all arguments are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('handles all truthy classes', () => {
    expect(cn('text-sm', 'font-bold', 'text-red-500')).toBe('text-sm font-bold text-red-500');
  });

  it('handles conditional class mix', () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn('btn', isActive && 'btn-active', isDisabled && 'btn-disabled')).toBe('btn btn-active');
  });

  it('handles empty string (empty string is falsy but cast to string is truthy)', () => {
    // empty string is falsy, so it gets filtered
    // The type only allows string | false | null | undefined, but '' is a string
    // filter(Boolean) removes '' since it's falsy
    expect(cn('a', '' as string, 'b')).toBe('a b');
  });
});
