import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins two class names with a space', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('joins many class names', () => {
    expect(cn('a', 'b', 'c', 'd')).toBe('a b c d');
  });

  it('returns a single class name unchanged', () => {
    expect(cn('only')).toBe('only');
  });

  it('returns empty string when called with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('filters out false values', () => {
    expect(cn('a', false, 'b')).toBe('a b');
  });

  it('filters out null values', () => {
    expect(cn('a', null, 'b')).toBe('a b');
  });

  it('filters out undefined values', () => {
    expect(cn('a', undefined, 'b')).toBe('a b');
  });

  it('filters out multiple falsy values in a row', () => {
    expect(cn(false, null, undefined, 'only')).toBe('only');
  });

  it('returns empty string when all values are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('handles conditional class pattern (truthy condition)', () => {
    const active = true;
    expect(cn('base', active && 'active')).toBe('base active');
  });

  it('handles conditional class pattern (falsy condition)', () => {
    const active = false;
    expect(cn('base', active && 'active')).toBe('base');
  });

  it('preserves class names that contain spaces (multi-class strings)', () => {
    expect(cn('px-4 py-2', 'font-bold')).toBe('px-4 py-2 font-bold');
  });

  it('handles all-falsy except last', () => {
    expect(cn(false, false, false, 'last')).toBe('last');
  });

  it('handles empty string as falsy-equivalent (filter)', () => {
    // empty string is falsy, should be filtered
    const result = cn('a', '' as unknown as false, 'b');
    expect(result).toBe('a b');
  });
});
