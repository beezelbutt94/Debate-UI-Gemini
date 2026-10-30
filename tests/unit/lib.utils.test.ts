import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins multiple truthy strings', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('filters out false values', () => {
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

  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('handles a single truthy class', () => {
    expect(cn('only')).toBe('only');
  });

  it('handles single falsy class', () => {
    expect(cn(false)).toBe('');
  });

  it('preserves class names with spaces inside them', () => {
    expect(cn('hover:bg-blue-500', 'text-sm')).toBe('hover:bg-blue-500 text-sm');
  });

  it('handles conditional pattern: condition && className', () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn('base', isActive && 'active', isDisabled && 'disabled')).toBe('base active');
  });
});
