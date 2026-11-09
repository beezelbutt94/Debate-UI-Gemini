import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn (class name merger)', () => {
  it('joins two class strings', () => {
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

  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('returns single class unchanged', () => {
    expect(cn('only-class')).toBe('only-class');
  });

  it('handles empty string (falsy — filtered out)', () => {
    // empty string is falsy in JS
    expect(cn('', 'valid')).toBe('valid');
  });

  it('handles all empty strings', () => {
    expect(cn('', '')).toBe('');
  });

  it('preserves whitespace within individual class strings', () => {
    expect(cn('  spaced  ', 'other')).toBe('  spaced   other');
  });

  it('handles conditional class toggling pattern', () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base active');
  });

  it('handles all truthy — no filtering needed', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('handles single falsy arg', () => {
    expect(cn(false)).toBe('');
  });

  it('handles mixed order of falsy values', () => {
    expect(cn(null, 'first', undefined, 'second', false)).toBe('first second');
  });
});
