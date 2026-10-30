import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins truthy string classes', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
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

  it('returns empty string for no valid classes', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns empty string with no args', () => {
    expect(cn()).toBe('');
  });

  it('handles a single class', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('handles all-false list', () => {
    expect(cn(false, false, false)).toBe('');
  });

  it('handles mixed truthy and all-falsy types', () => {
    expect(cn(null, undefined, false, 'px-4', null, 'text-sm')).toBe('px-4 text-sm');
  });

  it('preserves whitespace inside a class string', () => {
    expect(cn('a b')).toBe('a b');
  });

  it('handles empty string (falsy, filtered)', () => {
    // empty string is falsy, filtered out
    expect(cn('' as unknown as false, 'b')).toBe('b');
  });
});
