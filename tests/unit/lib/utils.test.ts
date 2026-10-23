import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('returns empty string for no arguments', () => {
    expect(cn()).toBe('');
  });

  it('returns a single class name', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('joins multiple class names with a space', () => {
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

  it('filters out all falsy values at once', () => {
    expect(cn(false, null, undefined, 'bar')).toBe('bar');
  });

  it('returns empty string when all arguments are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('preserves class names with spaces inside them', () => {
    // A string that already contains a space is kept as-is since cn does not split
    expect(cn('foo bar')).toBe('foo bar');
  });

  it('handles conditional class patterns (common Tailwind pattern)', () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base active');
  });

  it('handles ternary expressions evaluating to undefined', () => {
    const flag = false;
    expect(cn('base', flag ? 'yes' : undefined)).toBe('base');
  });

  it('handles many classes efficiently', () => {
    const classes = Array.from({ length: 50 }, (_, i) => `class-${i}`);
    const result = cn(...classes);
    expect(result).toBe(classes.join(' '));
  });

  it('does not trim or alter truthy class names', () => {
    expect(cn('  leading', 'trailing  ')).toBe('  leading trailing  ');
  });
});
