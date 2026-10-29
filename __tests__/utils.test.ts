import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('joins two truthy class strings', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('returns a single string unchanged', () => {
    expect(cn('only')).toBe('only');
  });

  it('returns empty string when called with no arguments', () => {
    expect(cn()).toBe('');
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

  it('filters out empty string (falsy)', () => {
    expect(cn('a', '', 'b')).toBe('a b');
  });

  it('handles all-falsy arguments', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('handles a mix of many classes', () => {
    expect(cn('text-sm', false, 'font-bold', null, 'mt-4', undefined)).toBe(
      'text-sm font-bold mt-4'
    );
  });

  it('preserves internal whitespace in individual class strings', () => {
    expect(cn('foo bar', 'baz')).toBe('foo bar baz');
  });

  it('handles a single falsy value', () => {
    expect(cn(false)).toBe('');
  });

  it('handles duplicate class names (no deduplication expected)', () => {
    expect(cn('btn', 'btn')).toBe('btn btn');
  });

  it('returns empty string when only empty strings are passed', () => {
    expect(cn('', '', '')).toBe('');
  });
});
