import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins two truthy class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('returns an empty string when called with no args', () => {
    expect(cn()).toBe('');
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

  it('filters out empty string (falsy)', () => {
    // empty string is falsy, so Boolean('') === false
    expect(cn('a', '' as unknown as false, 'b')).toBe('a b');
  });

  it('handles a single class', () => {
    expect(cn('only')).toBe('only');
  });

  it('handles only falsy values', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('preserves whitespace within a class string', () => {
    expect(cn('px-4 py-2', 'text-sm')).toBe('px-4 py-2 text-sm');
  });

  it('handles many classes', () => {
    expect(cn('a', 'b', 'c', 'd', 'e')).toBe('a b c d e');
  });

  it('mixed truthy and falsy values', () => {
    expect(cn('x', false, null, undefined, 'y', false)).toBe('x y');
  });
});
