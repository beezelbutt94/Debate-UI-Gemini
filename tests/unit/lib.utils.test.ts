import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn (class name combiner)', () => {
  it('joins two plain strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('filters out false', () => {
    expect(cn('foo', false, 'bar')).toBe('foo bar');
  });

  it('filters out null', () => {
    expect(cn('foo', null, 'bar')).toBe('foo bar');
  });

  it('filters out undefined', () => {
    expect(cn('foo', undefined, 'bar')).toBe('foo bar');
  });

  it('returns empty string when all values are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('handles a single truthy value', () => {
    expect(cn('only')).toBe('only');
  });

  it('handles multiple mixed falsy and truthy values in sequence', () => {
    expect(cn(null, 'a', false, 'b', undefined, 'c')).toBe('a b c');
  });

  it('preserves whitespace inside class strings', () => {
    expect(cn('flex items-center', 'text-sm')).toBe('flex items-center text-sm');
  });

  it('handles empty string (falsy — filtered out)', () => {
    // empty string is falsy, so it should be removed
    expect(cn('a', '' as unknown as false, 'b')).toBe('a b');
  });
});
