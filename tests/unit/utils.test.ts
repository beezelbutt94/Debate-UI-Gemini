import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('returns empty string when called with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('returns a single class unchanged', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('joins multiple classes with a space', () => {
    expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
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

  it('filters out all falsy values in one call', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('keeps classes that are truthy strings even if they look empty-ish', () => {
    expect(cn('flex', 'items-center', 'gap-2')).toBe('flex items-center gap-2');
  });

  it('handles a mix of truthy and falsy', () => {
    const isActive = false;
    const isDisabled = null;
    expect(cn('btn', isActive && 'btn-active', isDisabled)).toBe('btn');
  });

  it('preserves whitespace within individual class strings', () => {
    // cn does not split strings -- it joins whatever strings it receives
    expect(cn('  foo  ')).toBe('  foo  ');
  });
});
