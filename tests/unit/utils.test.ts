import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins two plain class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('filters out falsy values: false', () => {
    expect(cn('foo', false, 'bar')).toBe('foo bar');
  });

  it('filters out falsy values: null', () => {
    expect(cn('foo', null, 'bar')).toBe('foo bar');
  });

  it('filters out falsy values: undefined', () => {
    expect(cn('foo', undefined, 'bar')).toBe('foo bar');
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

  it('handles mix of truthy and falsy in arbitrary order', () => {
    expect(cn(false, 'a', null, 'b', undefined, 'c')).toBe('a b c');
  });

  it('preserves class strings with spaces inside them', () => {
    expect(cn('text-sm font-bold', 'mt-4')).toBe('text-sm font-bold mt-4');
  });

  it('handles empty string (falsy — filtered out)', () => {
    // empty string is falsy; filter(Boolean) drops it
    expect(cn('', 'bar')).toBe('bar');
  });
});
