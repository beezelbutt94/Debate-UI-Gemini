import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('returns empty string for no arguments', () => {
    expect(cn()).toBe('');
  });

  it('returns single class unchanged', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('joins multiple truthy classes with space', () => {
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

  it('filters out all falsy values mixed in', () => {
    expect(cn(false, null, undefined, 'real')).toBe('real');
  });

  it('returns empty string when all values are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('preserves classes with spaces inside them', () => {
    expect(cn('bg-red-500 text-white', 'p-4')).toBe('bg-red-500 text-white p-4');
  });

  it('handles conditional expression that resolves to string', () => {
    const active = true;
    expect(cn('base', active && 'active')).toBe('base active');
  });

  it('handles conditional expression that resolves to false', () => {
    const active = false;
    expect(cn('base', active && 'active')).toBe('base');
  });

  it('handles large number of classes', () => {
    const classes = Array.from({ length: 20 }, (_, i) => `class-${i}`);
    expect(cn(...classes)).toBe(classes.join(' '));
  });
});
