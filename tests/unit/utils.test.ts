import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cn } from '../../lib/utils.ts';

describe('cn()', () => {
  test('joins two plain class strings', () => {
    assert.equal(cn('foo', 'bar'), 'foo bar');
  });

  test('returns empty string when called with no arguments', () => {
    assert.equal(cn(), '');
  });

  test('filters out false', () => {
    assert.equal(cn('a', false, 'b'), 'a b');
  });

  test('filters out null', () => {
    assert.equal(cn('a', null, 'b'), 'a b');
  });

  test('filters out undefined', () => {
    assert.equal(cn('a', undefined, 'b'), 'a b');
  });

  test('filters out all falsy values together', () => {
    assert.equal(cn(false, null, undefined, 'x'), 'x');
  });

  test('returns single class unchanged', () => {
    assert.equal(cn('only'), 'only');
  });

  test('returns empty string when all values are falsy', () => {
    assert.equal(cn(false, null, undefined), '');
  });

  test('handles empty string arg (empty string is falsy, filtered out)', () => {
    // empty string is falsy so it gets filtered
    assert.equal(cn('a', '', 'b'), 'a b');
  });

  test('handles many classes', () => {
    assert.equal(cn('a', 'b', 'c', 'd', 'e'), 'a b c d e');
  });

  test('preserves class names with spaces inside (passthrough)', () => {
    assert.equal(cn('flex items-center', 'text-sm'), 'flex items-center text-sm');
  });
});
