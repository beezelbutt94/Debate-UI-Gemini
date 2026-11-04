import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins two plain strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('filters out false', () => {
    expect(cn('foo', false, 'bar')).toBe('foo bar');
  });

  it('filters out null', () => {
    expect(cn('foo', null, 'bar')).toBe('foo bar');
  });

  it('filters out undefined', () => {
    expect(cn('foo', undefined, 'bar')).toBe('foo bar');
  });

  it('returns empty string when all falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('handles a single truthy class', () => {
    expect(cn('only')).toBe('only');
  });

  it('handles no arguments', () => {
    expect(cn()).toBe('');
  });

  it('handles mixed truthy and falsy in various positions', () => {
    expect(cn(false, 'a', null, 'b', undefined, 'c')).toBe('a b c');
  });

  it('preserves the order of truthy classes', () => {
    expect(cn('z', 'a', 'm')).toBe('z a m');
  });

  it('handles empty string (falsy — filtered out)', () => {
    // Empty string is falsy in JS, so filter(Boolean) drops it
    expect(cn('a', '', 'b')).toBe('a b');
  });

  it('handles duplicate class names (no deduplication — just joins)', () => {
    expect(cn('foo', 'foo')).toBe('foo foo');
  });

  it('handles Tailwind-style class strings with spaces inside', () => {
    // cn is not a smart merger; it just joins the tokens it's given
    expect(cn('px-4 py-2', 'text-sm')).toBe('px-4 py-2 text-sm');
  });
});
