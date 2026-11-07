import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins multiple truthy strings', () => {
    expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
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

  it('handles a single class', () => {
    expect(cn('only')).toBe('only');
  });

  it('handles conditional class pattern', () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base active');
  });

  it('handles all falsy: false, null, undefined together', () => {
    expect(cn(false, null, undefined, false)).toBe('');
  });

  it('handles empty string (empty string is falsy-but-actually-truthy...)', () => {
    // empty string passes Boolean() as false, but filter(Boolean) removes it
    expect(cn('', 'foo')).toBe('foo');
  });

  it('preserves existing whitespace inside class strings', () => {
    expect(cn('foo bar', 'baz')).toBe('foo bar baz');
  });
});
