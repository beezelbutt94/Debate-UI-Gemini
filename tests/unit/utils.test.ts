import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins multiple truthy class strings', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('filters out falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });

  it('returns empty string when all values are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns empty string with no args', () => {
    expect(cn()).toBe('');
  });

  it('handles a single class', () => {
    expect(cn('only')).toBe('only');
  });

  it('preserves class names with spaces inside them', () => {
    expect(cn('text-sm font-bold', 'mt-2')).toBe('text-sm font-bold mt-2');
  });

  it('handles all-truthy array correctly', () => {
    const classes: Array<string | false | null | undefined> = ['x', 'y'];
    expect(cn(...classes)).toBe('x y');
  });

  it('handles mixed truthy and all-falsy partitions', () => {
    expect(cn(false, 'keep', null, 'this', undefined)).toBe('keep this');
  });
});
