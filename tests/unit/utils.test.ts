import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins multiple truthy class strings', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('returns single class unchanged', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('filters out false values', () => {
    expect(cn('a', false, 'b')).toBe('a b');
  });

  it('filters out null values', () => {
    expect(cn('a', null, 'b')).toBe('a b');
  });

  it('filters out undefined values', () => {
    expect(cn('a', undefined, 'b')).toBe('a b');
  });

  it('returns empty string when all values are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('handles empty string as truthy (filtered like falsy by Boolean)', () => {
    // empty string is falsy — filter(Boolean) removes it
    expect(cn('a', '', 'b')).toBe('a b');
  });

  it('preserves class names with spaces', () => {
    expect(cn('px-4 py-2', 'text-sm')).toBe('px-4 py-2 text-sm');
  });

  it('handles mix of all falsy types and real classes', () => {
    expect(cn(null, undefined, false, 'active', null, 'visible')).toBe('active visible');
  });
});
