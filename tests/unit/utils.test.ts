import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins two plain class strings', () => {
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

  it('returns empty string when all args are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns empty string with no args', () => {
    expect(cn()).toBe('');
  });

  it('handles a single truthy class', () => {
    expect(cn('solo')).toBe('solo');
  });

  it('handles many classes', () => {
    expect(cn('a', 'b', 'c', 'd')).toBe('a b c d');
  });

  it('preserves classes with internal spaces', () => {
    expect(cn('flex items-center', 'mt-2')).toBe('flex items-center mt-2');
  });

  it('handles mixed truthy and falsy in sequence', () => {
    expect(cn(false, 'x', null, 'y', undefined, 'z')).toBe('x y z');
  });

  it('handles empty string (falsy) correctly — filtered out', () => {
    // empty string is falsy so filter(Boolean) removes it
    const result = cn('a', '' as unknown as false, 'b');
    expect(result).toBe('a b');
  });
});
