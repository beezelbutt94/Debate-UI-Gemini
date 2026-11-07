import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins two plain strings', () => {
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

  it('returns empty string when all falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('handles a single truthy class', () => {
    expect(cn('only')).toBe('only');
  });

  it('handles mixed truthy and falsy', () => {
    expect(cn('a', false, null, undefined, 'b', 'c')).toBe('a b c');
  });

  it('preserves whitespace within individual class strings', () => {
    expect(cn('px-4 py-2', 'text-sm')).toBe('px-4 py-2 text-sm');
  });

  it('handles empty string (falsy — filtered out)', () => {
    // empty string is falsy, so filter(Boolean) drops it
    expect(cn('a', '', 'b')).toBe('a b');
  });

  it('handles many classes', () => {
    const result = cn('a', 'b', 'c', 'd', 'e');
    expect(result).toBe('a b c d e');
  });
});
