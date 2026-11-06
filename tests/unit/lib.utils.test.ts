import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins two plain strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('filters out falsy values – false', () => {
    expect(cn('a', false, 'b')).toBe('a b');
  });

  it('filters out falsy values – null', () => {
    expect(cn('a', null, 'b')).toBe('a b');
  });

  it('filters out falsy values – undefined', () => {
    expect(cn('a', undefined, 'b')).toBe('a b');
  });

  it('returns empty string when all args are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns empty string with no args', () => {
    expect(cn()).toBe('');
  });

  it('handles a single truthy class', () => {
    expect(cn('only')).toBe('only');
  });

  it('handles all falsy except one', () => {
    expect(cn(false, null, undefined, 'keep', false)).toBe('keep');
  });

  it('preserves whitespace inside class strings', () => {
    expect(cn('px-4 py-2', 'text-sm')).toBe('px-4 py-2 text-sm');
  });

  it('works with many classes', () => {
    expect(cn('a', 'b', 'c', 'd', 'e')).toBe('a b c d e');
  });
});
