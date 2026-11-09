import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins two plain class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('filters out false', () => {
    expect(cn('foo', false)).toBe('foo');
  });

  it('filters out null', () => {
    expect(cn('foo', null)).toBe('foo');
  });

  it('filters out undefined', () => {
    expect(cn('foo', undefined)).toBe('foo');
  });

  it('returns empty string when all falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('handles a single valid class', () => {
    expect(cn('only')).toBe('only');
  });

  it('handles conditional pattern correctly (truthy branch)', () => {
    const isActive = true;
    expect(cn('base', isActive && 'active')).toBe('base active');
  });

  it('handles conditional pattern correctly (falsy branch)', () => {
    const isActive = false;
    expect(cn('base', isActive && 'active')).toBe('base');
  });

  it('handles many classes', () => {
    expect(cn('a', 'b', 'c', 'd', 'e')).toBe('a b c d e');
  });

  it('handles empty string (filtered through Boolean)', () => {
    // empty string is falsy, so it should be filtered out
    expect(cn('a', '' as unknown as false, 'b')).toBe('a b');
  });

  it('handles mixed valid and falsy values', () => {
    expect(cn('px-4', null, 'py-2', false, 'rounded', undefined)).toBe('px-4 py-2 rounded');
  });

  it('preserves class string with spaces', () => {
    expect(cn('flex items-center')).toBe('flex items-center');
  });

  it('joins multiple multi-word classes', () => {
    expect(cn('flex items-center', 'justify-between gap-4')).toBe('flex items-center justify-between gap-4');
  });
});
