import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins multiple truthy class strings', () => {
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
    expect(cn('solo')).toBe('solo');
  });

  it('handles conditional class inclusion pattern', () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base active');
  });

  it('preserves class string with spaces (not split)', () => {
    expect(cn('a b', 'c')).toBe('a b c');
  });

  it('handles empty strings (falsy-filtered in JS but truthy type)', () => {
    // empty string '' is falsy, so Boolean('') = false and it's filtered
    const result = cn('a', '' as unknown as string, 'b');
    expect(result).toBe('a b');
  });
});
