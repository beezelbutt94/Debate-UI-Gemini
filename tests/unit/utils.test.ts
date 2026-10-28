import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins two plain strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('returns empty string when called with no arguments', () => {
    expect(cn()).toBe('');
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

  it('handles a single truthy string', () => {
    expect(cn('only')).toBe('only');
  });

  it('handles all falsy arguments', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('preserves Tailwind utility class names with colons and slashes', () => {
    expect(cn('text-red-500', 'hover:bg-blue-300', 'w-1/2')).toBe(
      'text-red-500 hover:bg-blue-300 w-1/2'
    );
  });

  it('handles conditional class pattern', () => {
    const isActive = true;
    expect(cn('base', isActive && 'active')).toBe('base active');
  });

  it('handles conditional class pattern when condition is false', () => {
    const isActive = false;
    expect(cn('base', isActive && 'active')).toBe('base');
  });

  it('handles multiple sequential falsy values between truthy ones', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });

  it('preserves class names with numbers', () => {
    expect(cn('p-4', 'mt-2', 'gap-8')).toBe('p-4 mt-2 gap-8');
  });

  it('returns the exact string when a single class has extra internal spaces', () => {
    // cn does not trim internal content — it only filters falsy entries
    expect(cn('  spaced  ')).toBe('  spaced  ');
  });
});
