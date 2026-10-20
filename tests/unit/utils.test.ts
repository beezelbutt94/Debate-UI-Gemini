import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins two truthy classes with a space', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('joins three truthy classes', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('returns single class unchanged', () => {
    expect(cn('solo')).toBe('solo');
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

  it('handles leading/trailing falsy values', () => {
    expect(cn(false, 'middle', null)).toBe('middle');
  });

  it('preserves whitespace within a class string', () => {
    expect(cn('a b', 'c d')).toBe('a b c d');
  });

  it('handles conditional class patterns (truthy condition)', () => {
    const active = true;
    expect(cn('base', active && 'active')).toBe('base active');
  });

  it('handles conditional class patterns (falsy condition)', () => {
    const active = false;
    expect(cn('base', active && 'active')).toBe('base');
  });

  it('handles empty string values', () => {
    // empty string is falsy so it should be filtered out
    expect(cn('a', '' as unknown as false, 'b')).toBe('a b');
  });

  it('does not add extra spaces between classes', () => {
    const result = cn('one', 'two', 'three');
    expect(result.split(' ').length).toBe(3);
  });
});
