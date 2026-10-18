import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('returns empty string for no arguments', () => {
    expect(cn()).toBe('');
  });

  it('joins two truthy strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
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

  it('filters out all falsy values together', () => {
    expect(cn(false, null, undefined, 'only')).toBe('only');
  });

  it('returns empty string when all values are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('handles a single string', () => {
    expect(cn('hello')).toBe('hello');
  });

  it('handles many strings', () => {
    expect(cn('a', 'b', 'c', 'd')).toBe('a b c d');
  });

  it('preserves internal spaces within strings', () => {
    expect(cn('text-lg font-bold', 'mt-4')).toBe('text-lg font-bold mt-4');
  });

  it('handles empty string values (falsy – filtered out)', () => {
    // Empty string is falsy
    expect(cn('a', '' as unknown as false, 'b')).toBe('a b');
  });
});
