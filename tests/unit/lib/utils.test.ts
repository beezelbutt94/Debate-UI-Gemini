import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins two truthy class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('joins multiple truthy class strings', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
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

  it('filters out all falsy types together', () => {
    expect(cn('only', false, null, undefined)).toBe('only');
  });

  it('returns empty string when all values are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('returns empty string when called with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('handles a single truthy class', () => {
    expect(cn('single')).toBe('single');
  });

  it('preserves class order', () => {
    expect(cn('first', 'second', 'third')).toBe('first second third');
  });

  it('preserves whitespace within individual class strings', () => {
    expect(cn('flex items-center', 'text-sm')).toBe('flex items-center text-sm');
  });

  it('does not deduplicate identical classes', () => {
    expect(cn('dup', 'dup')).toBe('dup dup');
  });
});
