import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins multiple class strings', () => {
    expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
  });

  it('returns empty string when called with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('returns the single class unchanged', () => {
    expect(cn('only')).toBe('only');
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

  it('filters out all falsy values together', () => {
    expect(cn(false, null, undefined, 'real')).toBe('real');
  });

  it('returns empty string when every value is falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('preserves class names with spaces (multi-class strings)', () => {
    expect(cn('text-red-500', 'font-bold')).toBe('text-red-500 font-bold');
  });

  it('handles a conditional class pattern', () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn('btn', isActive && 'btn-active', isDisabled && 'btn-disabled')).toBe('btn btn-active');
  });

  it('handles empty string values (they pass filter(Boolean) → excluded)', () => {
    // empty string is falsy, so it gets filtered out
    expect(cn('a', '', 'b')).toBe('a b');
  });

  it('returns correct result for a long list', () => {
    const classes = Array.from({ length: 50 }, (_, i) => `cls-${i}`);
    const result = cn(...classes);
    expect(result.split(' ')).toHaveLength(50);
    expect(result).toContain('cls-0');
    expect(result).toContain('cls-49');
  });
});
