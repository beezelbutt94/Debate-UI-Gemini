import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins truthy class strings', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('filters out falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });

  it('returns empty string when all values are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('handles single class', () => {
    expect(cn('only')).toBe('only');
  });

  it('handles no arguments', () => {
    expect(cn()).toBe('');
  });

  it('handles empty string (falsy)', () => {
    // empty string is falsy — should be filtered
    expect(cn('a', '' as unknown as false, 'b')).toBe('a b');
  });

  it('does not trim individual class names', () => {
    expect(cn('  spaced  ')).toBe('  spaced  ');
  });

  it('preserves order', () => {
    expect(cn('first', 'second', 'third')).toBe('first second third');
  });
});
