import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins multiple string classes', () => {
    expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
  });

  it('returns a single class unchanged', () => {
    expect(cn('only')).toBe('only');
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

  it('filters all falsy — returns empty string', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('handles a single falsy argument', () => {
    expect(cn(false)).toBe('');
  });

  it('preserves whitespace within a class string', () => {
    expect(cn('text-red-500 font-bold')).toBe('text-red-500 font-bold');
  });

  it('mixes truthy strings and all falsy types correctly', () => {
    expect(cn('x', false, null, undefined, 'y')).toBe('x y');
  });

  it('handles conditional class pattern (truthy condition)', () => {
    const active = true;
    expect(cn('base', active && 'active')).toBe('base active');
  });

  it('handles conditional class pattern (falsy condition)', () => {
    const active = false;
    expect(cn('base', active && 'active')).toBe('base');
  });

  it('handles empty string argument (filters it out as falsy)', () => {
    // empty string is falsy; it should be filtered
    expect(cn('a', '' as unknown as false, 'b')).toBe('a b');
  });
});
