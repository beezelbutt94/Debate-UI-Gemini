import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins two truthy strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('joins multiple strings', () => {
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

  it('filters all falsy values mixed in', () => {
    expect(cn(false, null, undefined, 'x', false, 'y')).toBe('x y');
  });

  it('returns empty string when all values are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('handles a single string', () => {
    expect(cn('only')).toBe('only');
  });

  it('handles a single false value', () => {
    expect(cn(false)).toBe('');
  });

  it('preserves class strings with spaces inside them', () => {
    expect(cn('px-4 py-2', 'text-sm')).toBe('px-4 py-2 text-sm');
  });

  it('handles empty strings (falsy — filtered out)', () => {
    // empty string is falsy, so Boolean('') === false
    expect(cn('a', '' as unknown as false, 'b')).toBe('a b');
  });
});
