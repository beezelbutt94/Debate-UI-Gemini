import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins multiple strings', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('returns single string unchanged', () => {
    expect(cn('only')).toBe('only');
  });

  it('returns empty string when called with no arguments', () => {
    expect(cn()).toBe('');
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

  it('returns empty string when all values are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('preserves extra whitespace inside class strings', () => {
    expect(cn('flex  gap-2')).toBe('flex  gap-2');
  });

  it('handles conditional class pattern', () => {
    const active = true;
    const disabled = false;
    expect(cn('base', active && 'active', disabled && 'disabled')).toBe('base active');
  });

  it('handles all-falsy conditional pattern', () => {
    const active = false;
    expect(cn('base', active && 'active')).toBe('base');
  });

  it('handles empty string values (passes them through as truthy)', () => {
    // empty string is falsy so it gets filtered
    expect(cn('a', '' as unknown as false, 'b')).toBe('a b');
  });

  it('joins many classes correctly', () => {
    const classes = Array.from({ length: 10 }, (_, i) => `cls-${i}`);
    expect(cn(...classes)).toBe(classes.join(' '));
  });
});
