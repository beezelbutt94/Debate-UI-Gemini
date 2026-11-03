import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('returns empty string when called with no args', () => {
    expect(cn()).toBe('');
  });

  it('returns a single class unchanged', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('joins multiple truthy classes with a space', () => {
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

  it('filters out multiple falsy values', () => {
    expect(cn(false, null, undefined, 'real')).toBe('real');
  });

  it('returns empty string when all args are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('preserves class names with spaces (e.g. compound Tailwind classes)', () => {
    expect(cn('flex items-center', 'gap-4')).toBe('flex items-center gap-4');
  });

  it('handles a single empty-string arg (filtered out as falsy)', () => {
    // empty string is falsy in JS
    expect(cn('' as unknown as false)).toBe('');
  });

  it('handles duplicate class names (keeps both as-is)', () => {
    expect(cn('foo', 'foo')).toBe('foo foo');
  });
});
