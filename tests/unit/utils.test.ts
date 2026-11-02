import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins truthy string classes', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('filters out falsy values: false', () => {
    expect(cn('foo', false, 'bar')).toBe('foo bar');
  });

  it('filters out falsy values: null', () => {
    expect(cn('foo', null, 'bar')).toBe('foo bar');
  });

  it('filters out falsy values: undefined', () => {
    expect(cn('foo', undefined, 'bar')).toBe('foo bar');
  });

  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('returns empty string with all falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns single class unchanged', () => {
    expect(cn('only')).toBe('only');
  });

  it('handles multiple falsy interspersed with truthy', () => {
    expect(cn(null, 'a', false, 'b', undefined, 'c')).toBe('a b c');
  });

  it('preserves classes with spaces inside', () => {
    expect(cn('hover:bg-blue-500', 'text-sm')).toBe('hover:bg-blue-500 text-sm');
  });

  it('handles empty string as falsy-like (empty string is truthy but empty)', () => {
    // empty string IS falsy in JS — filter(Boolean) removes it
    expect(cn('a', '', 'b')).toBe('a b');
  });
});
