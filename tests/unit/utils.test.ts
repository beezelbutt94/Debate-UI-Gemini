import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins two plain strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
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

  it('returns empty string when all falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns empty string with no args', () => {
    expect(cn()).toBe('');
  });

  it('handles a single class', () => {
    expect(cn('only')).toBe('only');
  });

  it('handles conditional pattern (truthy condition)', () => {
    const isActive = true;
    expect(cn('base', isActive && 'active')).toBe('base active');
  });

  it('handles conditional pattern (falsy condition)', () => {
    const isActive = false;
    expect(cn('base', isActive && 'active')).toBe('base');
  });

  it('preserves class strings with spaces as-is', () => {
    expect(cn('px-4 py-2', 'text-sm')).toBe('px-4 py-2 text-sm');
  });

  it('handles multiple mixed truthy/falsy args', () => {
    expect(cn('a', null, 'b', undefined, false, 'c')).toBe('a b c');
  });

  it('handles empty string (truthy but empty -- filtered by Boolean)', () => {
    // empty string is falsy, so it gets filtered
    expect(cn('a', '' as unknown as false, 'b')).toBe('a b');
  });
});
