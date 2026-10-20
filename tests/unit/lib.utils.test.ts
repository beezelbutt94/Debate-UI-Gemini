import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins two truthy strings', () => {
    expect(cn('a', 'b')).toBe('a b');
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

  it('returns empty string when all falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('single truthy class', () => {
    expect(cn('only')).toBe('only');
  });

  it('multiple truthy classes', () => {
    expect(cn('a', 'b', 'c', 'd')).toBe('a b c d');
  });

  it('preserves class with spaces inside it', () => {
    expect(cn('foo bar')).toBe('foo bar');
  });

  it('mixed truthy and all falsy varieties', () => {
    expect(cn('start', false, null, undefined, 'end')).toBe('start end');
  });

  it('empty string is falsy and gets filtered', () => {
    // empty string is falsy in JS, so filter(Boolean) removes it
    expect(cn('a', '' as unknown as false, 'b')).toBe('a b');
  });
});
