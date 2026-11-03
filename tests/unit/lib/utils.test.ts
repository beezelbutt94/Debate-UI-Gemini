import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('returns empty string when called with no args', () => {
    expect(cn()).toBe('');
  });

  it('returns single class unchanged', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('joins multiple classes with a space', () => {
    expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
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

  it('filters out empty string', () => {
    expect(cn('a', '', 'b')).toBe('a b');
  });

  it('handles all-falsy arguments', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('preserves classes with internal spaces', () => {
    expect(cn('text-sm font-bold', 'mt-4')).toBe('text-sm font-bold mt-4');
  });

  it('handles conditional Tailwind class pattern', () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base active');
  });

  it('handles all-truthy single value', () => {
    expect(cn('only-class')).toBe('only-class');
  });

  it('handles a mix of truthy and falsy at every position', () => {
    expect(cn(null, 'a', false, 'b', undefined, 'c', '')).toBe('a b c');
  });
});
