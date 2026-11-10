import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins two truthy class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
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

  it('handles mixed truthy/falsy in sequence', () => {
    expect(cn('a', false, 'b', null, 'c', undefined)).toBe('a b c');
  });

  it('handles empty string (falsy — filtered out)', () => {
    expect(cn('a', '' as unknown as false, 'b')).toBe('a b');
  });

  it('preserves class names with spaces inside them', () => {
    expect(cn('hover:text-blue-500', 'focus:ring-2')).toBe('hover:text-blue-500 focus:ring-2');
  });

  it('returns single class when only one is truthy', () => {
    expect(cn(false, null, 'active', undefined)).toBe('active');
  });
});
