import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn()', () => {
  it('returns empty string with no arguments', () => {
    expect(cn()).toBe('');
  });

  it('returns single class unchanged', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('joins multiple classes with a space', () => {
    expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
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

  it('filters out all falsy values together', () => {
    expect(cn(false, null, undefined, 'keep')).toBe('keep');
  });

  it('returns empty string when all values are falsy', () => {
    expect(cn(false, null, undefined)).toBe('');
  });

  it('preserves class names that contain spaces (passed as single arg)', () => {
    expect(cn('foo bar', 'baz')).toBe('foo bar baz');
  });

  it('handles conditional expression that evaluates to string', () => {
    const condition = true;
    expect(cn('base', condition && 'active')).toBe('base active');
  });

  it('handles conditional expression that evaluates to false', () => {
    const condition = false;
    expect(cn('base', condition && 'active')).toBe('base');
  });

  it('handles a large number of arguments', () => {
    const classes = Array.from({ length: 50 }, (_, i) => `class-${i}`);
    expect(cn(...classes)).toBe(classes.join(' '));
  });

  it('trims nothing — preserves strings as-is', () => {
    expect(cn('  foo  ')).toBe('  foo  ');
  });

  it('handles empty string arguments (empty string is falsy — filtered)', () => {
    // empty string is falsy in JavaScript; cn filters via Boolean()
    expect(cn('a', '' as unknown as false, 'b')).toBe('a b');
  });
});
