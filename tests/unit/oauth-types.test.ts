import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { isOAuthPlatform } from '../../lib/oauth/types.ts';

describe('isOAuthPlatform()', () => {
  test('returns true for "youtube"', () => {
    assert.equal(isOAuthPlatform('youtube'), true);
  });

  test('returns true for "tiktok"', () => {
    assert.equal(isOAuthPlatform('tiktok'), true);
  });

  test('returns true for "facebook"', () => {
    assert.equal(isOAuthPlatform('facebook'), true);
  });

  test('returns true for "canva"', () => {
    assert.equal(isOAuthPlatform('canva'), true);
  });

  test('returns false for "instagram"', () => {
    assert.equal(isOAuthPlatform('instagram'), false);
  });

  test('returns false for "twitter"', () => {
    assert.equal(isOAuthPlatform('twitter'), false);
  });

  test('returns false for empty string', () => {
    assert.equal(isOAuthPlatform(''), false);
  });

  test('returns false for "YouTube" (uppercase)', () => {
    assert.equal(isOAuthPlatform('YouTube'), false);
  });

  test('returns false for "TikTok" (mixed case)', () => {
    assert.equal(isOAuthPlatform('TikTok'), false);
  });

  test('returns false for random string', () => {
    assert.equal(isOAuthPlatform('notaplatform'), false);
  });

  test('returns false for "facebook_reels" (internal platform name)', () => {
    assert.equal(isOAuthPlatform('facebook_reels'), false);
  });

  test('returns false for "youtube_shorts" (internal platform name)', () => {
    assert.equal(isOAuthPlatform('youtube_shorts'), false);
  });
});
