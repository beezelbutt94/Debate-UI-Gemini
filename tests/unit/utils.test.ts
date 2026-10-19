import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins two class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('returns single class unchanged', () => {
    expect(cn('only')).toBe('only');
  });

  it('filters out false values', () => {
    expect(cn('a', false, 'b')).toBe('a b');
  });

  it('filters out null values', () => {
    expect(cn('a', null, 'b')).toBe('a b');
  });

  it('filters out undefined values', () => {
    expect(cn('a', undefined, 'b')).toBe('a b');
  });

  it('returns empty string when all values are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('handles multiple truthy and falsy values mixed', () => {
    expect(cn('x', false, null, 'y', undefined, 'z')).toBe('x y z');
  });

  it('preserves spacing within individual class strings', () => {
    expect(cn('px-4 py-2', 'text-sm')).toBe('px-4 py-2 text-sm');
  });

  it('handles empty string in the list', () => {
    // empty string is falsy — filtered out
    expect(cn('a', '' as unknown as false, 'b')).toBe('a b');
  });
});
