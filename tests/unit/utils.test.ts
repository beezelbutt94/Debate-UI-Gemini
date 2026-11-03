import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins two truthy strings', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('joins many truthy strings', () => {
    expect(cn('a', 'b', 'c', 'd')).toBe('a b c d');
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

  it('filters out empty string (falsy)', () => {
    expect(cn('a', '' as string, 'b')).toBe('a b');
  });

  it('returns empty string when all are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('handles single truthy value', () => {
    expect(cn('only')).toBe('only');
  });

  it('handles single falsy value', () => {
    expect(cn(false)).toBe('');
  });

  it('handles mixed leading/trailing falsy', () => {
    expect(cn(null, 'mid', undefined)).toBe('mid');
  });

  it('handles all-false array', () => {
    expect(cn(false, false, false)).toBe('');
  });

  it('preserves internal spaces in individual class strings', () => {
    expect(cn('flex items-center', 'bg-red-500')).toBe('flex items-center bg-red-500');
  });

  it('conditional Tailwind pattern: only one branch is truthy', () => {
    const isActive = true;
    expect(cn('base', isActive && 'active', !isActive && 'inactive')).toBe('base active');
  });

  it('conditional Tailwind pattern: no branch is truthy', () => {
    const isActive = false;
    const isDisabled = false;
    expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base');
  });
});
