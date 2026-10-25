import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins truthy strings', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('filters out falsy values — false', () => {
    expect(cn('a', false, 'b')).toBe('a b');
  });

  it('filters out falsy values — null', () => {
    expect(cn('a', null, 'b')).toBe('a b');
  });

  it('filters out falsy values — undefined', () => {
    expect(cn('a', undefined, 'b')).toBe('a b');
  });

  it('handles all falsy values', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('handles a single truthy string', () => {
    expect(cn('only')).toBe('only');
  });

  it('handles no arguments', () => {
    expect(cn()).toBe('');
  });

  it('preserves internal whitespace in individual class strings', () => {
    expect(cn('foo bar', 'baz')).toBe('foo bar baz');
  });

  it('handles mixed truthy/falsy in long arrays', () => {
    expect(cn('a', false, null, undefined, 'b', 'c', false)).toBe('a b c');
  });

  it('handles empty strings (falsy)', () => {
    // empty string is falsy — filter removes it
    expect(cn('a', '' as unknown as false, 'b')).toBe('a b');
  });
});
