import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn (class name combiner)', () => {
  it('joins multiple truthy strings', () => {
    expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
  });

  it('filters out falsy values: false', () => {
    expect(cn('a', false, 'b')).toBe('a b');
  });

  it('filters out falsy values: null', () => {
    expect(cn('a', null, 'b')).toBe('a b');
  });

  it('filters out falsy values: undefined', () => {
    expect(cn('a', undefined, 'b')).toBe('a b');
  });

  it('filters out empty strings', () => {
    // empty string is falsy
    expect(cn('a', '' as unknown as false, 'b')).toBe('a b');
  });

  it('returns empty string when all falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('handles a single class', () => {
    expect(cn('only')).toBe('only');
  });

  it('handles no args', () => {
    expect(cn()).toBe('');
  });

  it('handles conditional expression pattern', () => {
    const active = true;
    const disabled = false;
    expect(cn('base', active && 'active', disabled && 'disabled')).toBe('base active');
  });

  it('preserves whitespace within individual class strings', () => {
    expect(cn('px-4 py-2', 'text-sm')).toBe('px-4 py-2 text-sm');
  });
});
