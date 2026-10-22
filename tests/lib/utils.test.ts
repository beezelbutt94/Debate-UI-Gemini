import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins truthy string classes', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('filters out falsy values', () => {
    expect(cn('foo', false, null, undefined, 'bar')).toBe('foo bar');
  });

  it('returns empty string when all args are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('returns single class unchanged', () => {
    expect(cn('only')).toBe('only');
  });

  it('handles empty string (falsy) correctly', () => {
    // empty string is falsy in JS — filter(Boolean) removes it
    expect(cn('a', '' as unknown as false, 'b')).toBe('a b');
  });

  it('does not add extra spaces', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('preserves classes with spaces inside (passthrough)', () => {
    expect(cn('flex items-center', 'text-sm')).toBe('flex items-center text-sm');
  });
});
