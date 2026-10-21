import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cn } from '../../lib/utils.ts';

describe('cn', () => {
  test('joins multiple class strings', () => {
    assert.equal(cn('a', 'b', 'c'), 'a b c');
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

  test('filters all falsy values together', () => {
    assert.equal(cn(false, null, undefined, 'visible'), 'visible');
  });

  test('returns empty string when all falsy', () => {
    assert.equal(cn(false, null, undefined), '');
  });

  test('returns empty string with no arguments', () => {
    assert.equal(cn(), '');
  });

  test('returns single class unchanged', () => {
    assert.equal(cn('only'), 'only');
  });

  test('preserves class names with spaces inside them', () => {
    assert.equal(cn('foo bar', 'baz'), 'foo bar baz');
  });

  test('empty string is falsy and gets filtered', () => {
    // empty string is falsy → filtered out
    assert.equal(cn('a', '' as unknown as false, 'b'), 'a b');
  });
});
