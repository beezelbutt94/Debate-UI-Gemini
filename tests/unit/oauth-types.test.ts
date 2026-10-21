import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isOAuthPlatform } from '../../lib/oauth/types.ts';

describe('isOAuthPlatform', () => {
  test('returns true for "youtube"', () => {
    assert.ok(isOAuthPlatform('youtube'));
  });

  test('returns true for "tiktok"', () => {
    assert.ok(isOAuthPlatform('tiktok'));
  });

  test('returns true for "facebook"', () => {
    assert.ok(isOAuthPlatform('facebook'));
  });

  test('returns true for "canva"', () => {
    assert.ok(isOAuthPlatform('canva'));
  });

  test('returns false for "instagram"', () => {
    assert.equal(isOAuthPlatform('instagram'), false);
  });

  test('returns false for "google"', () => {
    assert.equal(isOAuthPlatform('google'), false);
  });

  test('returns false for "twitter"', () => {
    assert.equal(isOAuthPlatform('twitter'), false);
  });

  test('returns false for empty string', () => {
    assert.equal(isOAuthPlatform(''), false);
  });

  test('returns false for "YouTube" (case-sensitive)', () => {
    assert.equal(isOAuthPlatform('YouTube'), false);
  });

  test('returns false for "TikTok" (case-sensitive)', () => {
    assert.equal(isOAuthPlatform('TikTok'), false);
  });

  test('returns false for "Facebook" (case-sensitive)', () => {
    assert.equal(isOAuthPlatform('Facebook'), false);
  });

  test('returns false for arbitrary string', () => {
    assert.equal(isOAuthPlatform('notaplatform'), false);
  });

  test('all four valid platforms pass', () => {
    const valid = ['youtube', 'tiktok', 'facebook', 'canva'];
    for (const p of valid) {
      assert.ok(isOAuthPlatform(p), `Expected isOAuthPlatform("${p}") to be true`);
    }
  });
});
