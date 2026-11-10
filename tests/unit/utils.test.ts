import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins multiple truthy class strings', () => {
    expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
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

  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('handles a single truthy class', () => {
    expect(cn('only')).toBe('only');
  });

  it('handles a single falsy class', () => {
    expect(cn(false)).toBe('');
  });

  it('handles mixed order: falsy first', () => {
    expect(cn(null, 'a', false, 'b', undefined)).toBe('a b');
  });

  it('preserves whitespace within class strings', () => {
    expect(cn('a b', 'c d')).toBe('a b c d');
  });

  it('handles empty string (falsy — filtered out)', () => {
    // empty string is falsy in JS
    expect(cn('' as unknown as false, 'x')).toBe('x');
  });

  it('handles all-truthy large input', () => {
    const classes = Array.from({ length: 20 }, (_, i) => `cls-${i}`);
    expect(cn(...classes)).toBe(classes.join(' '));
  });
});
