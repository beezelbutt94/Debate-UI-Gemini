import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins two plain strings', () => {
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

  it('returns empty string when all falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('returns single class unchanged', () => {
    expect(cn('only')).toBe('only');
  });

  it('handles multiple mixed values', () => {
    expect(cn('a', null, 'b', false, 'c', undefined)).toBe('a b c');
  });

  it('preserves class strings with spaces inside them', () => {
    // cn is NOT tailwind-merge – it joins whatever strings it receives
    expect(cn('flex flex-col', 'gap-4')).toBe('flex flex-col gap-4');
  });

  it('preserves empty string as a class (truthy-filter passes non-empty strings)', () => {
    // empty string is falsy, so it should be filtered out
    expect(cn('a', '' as unknown as false, 'b')).toBe('a b');
  });
});
