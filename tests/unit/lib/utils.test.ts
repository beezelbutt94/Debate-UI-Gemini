import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('returns single class unchanged', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('joins multiple classes with a space', () => {
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

  it('filters all falsy values in one call', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('filters empty string (falsy)', () => {
    expect(cn('a', '', 'b')).toBe('a b');
  });

  it('preserves internal whitespace within individual class strings', () => {
    expect(cn('px-4 py-2', 'text-sm')).toBe('px-4 py-2 text-sm');
  });

  it('handles a mix of truthy and falsy values across all types', () => {
    expect(cn('base', false, null, undefined, 'extra')).toBe('base extra');
  });

  it('returns single class when only one truthy value exists', () => {
    expect(cn(false, null, 'only', undefined)).toBe('only');
  });

  it('handles all same class repeated', () => {
    expect(cn('foo', 'foo', 'foo')).toBe('foo foo foo');
  });
});
