import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins two truthy class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('returns a single class unchanged', () => {
    expect(cn('only')).toBe('only');
  });

  it('returns empty string when no args', () => {
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

  it('filters out empty string', () => {
    // empty string is falsy; filter(Boolean) removes it
    expect(cn('a', '' as unknown as false, 'b')).toBe('a b');
  });

  it('returns empty string when all values are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('preserves leading/trailing spaces inside a class string', () => {
    expect(cn('  foo  ')).toBe('  foo  ');
  });

  it('handles many classes', () => {
    const result = cn('a', 'b', 'c', 'd', 'e');
    expect(result).toBe('a b c d e');
  });

  it('handles mixed truthy and falsy', () => {
    const result = cn('x', false, null, undefined, 'y', false, 'z');
    expect(result).toBe('x y z');
  });

  it('handles conditional pattern (ternary)', () => {
    const active = true;
    expect(cn('base', active ? 'active' : false)).toBe('base active');
    expect(cn('base', !active ? 'active' : false)).toBe('base');
  });

  it('returns string type always', () => {
    expect(typeof cn()).toBe('string');
    expect(typeof cn(false, null)).toBe('string');
  });
});
