import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('returns a single class unchanged', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('joins multiple classes with a space', () => {
    expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
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

  it('filters all falsy; returns empty string', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('preserves classes with spaces inside them', () => {
    expect(cn('a b', 'c')).toBe('a b c');
  });

  it('handles a mix of truthy and falsy conditionally', () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base active');
  });

  it('handles all-empty-string inputs (empty string is falsy-adjacent but truthy)', () => {
    // empty string is truthy enough to pass filter(Boolean): '' is falsy
    expect(cn('')).toBe('');
  });
});
