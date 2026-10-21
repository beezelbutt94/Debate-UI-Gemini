import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('returns a single truthy class unchanged', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('joins multiple truthy classes with a space', () => {
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

  it('filters all falsy values together', () => {
    expect(cn(false, null, undefined, 'real')).toBe('real');
  });

  it('returns empty string when all args are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('handles conditional class pattern', () => {
    const active = true;
    const disabled = false;
    expect(cn('base', active && 'active', disabled && 'disabled')).toBe('base active');
  });

  it('handles empty string (falsy) by including it — filter(Boolean) drops it', () => {
    // Empty string is falsy, so cn filters it out
    expect(cn('a', '' as unknown as false, 'b')).toBe('a b');
  });

  it('handles a single falsy argument', () => {
    expect(cn(false)).toBe('');
  });

  it('preserves class names with spaces inside them', () => {
    expect(cn('foo bar', 'baz')).toBe('foo bar baz');
  });
});
