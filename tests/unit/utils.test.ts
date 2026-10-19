import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins two truthy class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
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

  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('handles a single class string', () => {
    expect(cn('only')).toBe('only');
  });

  it('preserves classes with spaces inside them', () => {
    expect(cn('p-4 m-2', 'text-red-500')).toBe('p-4 m-2 text-red-500');
  });

  it('handles many mixed args', () => {
    expect(cn('a', false, null, undefined, 'b', 'c')).toBe('a b c');
  });

  it('works with conditional class patterns', () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base active');
  });

  it('handles empty string inputs (empty strings are falsy)', () => {
    expect(cn('', 'foo', '')).toBe('foo');
  });
});
