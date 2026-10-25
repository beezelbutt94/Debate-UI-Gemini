import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins truthy strings', () => {
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

  it('returns empty string when all falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('works with a single class', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('works with no args', () => {
    expect(cn()).toBe('');
  });

  it('handles mixed truthy and all-falsy inputs', () => {
    expect(cn(false, null, undefined, 'hello', false)).toBe('hello');
  });

  it('preserves spaces inside class strings', () => {
    expect(cn('px-4 py-2', 'text-sm')).toBe('px-4 py-2 text-sm');
  });

  it('handles empty string (falsy) gracefully', () => {
    // empty string is falsy — filter removes it
    const result = cn('a', '' as unknown as false, 'b');
    expect(result).toBe('a b');
  });
});
