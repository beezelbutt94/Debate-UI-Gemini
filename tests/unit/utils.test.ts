import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins multiple truthy class strings', () => {
    expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
  });

  it('filters out false values', () => {
    expect(cn('foo', false, 'bar')).toBe('foo bar');
  });

  it('filters out null values', () => {
    expect(cn('foo', null, 'bar')).toBe('foo bar');
  });

  it('filters out undefined values', () => {
    expect(cn('foo', undefined, 'bar')).toBe('foo bar');
  });

  it('returns empty string when all values are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns single class with no extra spaces', () => {
    expect(cn('only')).toBe('only');
  });

  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('handles mixed truthy and falsy in order', () => {
    expect(cn(false, 'a', null, 'b', undefined, 'c')).toBe('a b c');
  });

  it('does not filter empty string (Boolean("") is false, filter removes it)', () => {
    expect(cn('', 'foo')).toBe('foo');
  });

  it('handles a single falsy value', () => {
    expect(cn(false)).toBe('');
  });
});
