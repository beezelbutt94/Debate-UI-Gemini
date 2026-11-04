import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins non-empty strings', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
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

  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('handles a single value', () => {
    expect(cn('only')).toBe('only');
  });

  it('handles conditional class patterns', () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base active');
  });

  it('preserves whitespace within individual class strings', () => {
    expect(cn('foo bar', 'baz')).toBe('foo bar baz');
  });

  it('handles all falsy variations at once', () => {
    expect(cn(false, null, undefined, 'real')).toBe('real');
  });
});
