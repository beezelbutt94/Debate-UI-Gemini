import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins non-empty strings with a space', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
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

  it('returns empty string when all values are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('returns single class unchanged', () => {
    expect(cn('only')).toBe('only');
  });

  it('handles empty string arguments (they are truthy so kept)', () => {
    // empty string is falsy — should be filtered
    expect(cn('a', '' as unknown as false, 'b')).toBe('a b');
  });

  it('handles mixed truthy and falsy values', () => {
    expect(cn('foo', false, null, 'bar', undefined, 'baz')).toBe('foo bar baz');
  });

  it('preserves class strings with spaces', () => {
    expect(cn('text-red-500', 'font-bold')).toBe('text-red-500 font-bold');
  });
});
