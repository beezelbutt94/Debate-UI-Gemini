import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { detectPlatform, buildAccountProfileUrl } from '../../lib/platform.ts';

describe('detectPlatform', () => {
  // TikTok
  test('tiktok: www prefix', () => {
    assert.equal(detectPlatform('https://www.tiktok.com/@user/video/123'), 'tiktok');
  });

  test('tiktok: no www prefix', () => {
    assert.equal(detectPlatform('https://tiktok.com/@user/video/123'), 'tiktok');
  });

  test('tiktok: vm subdomain', () => {
    assert.equal(detectPlatform('https://vm.tiktok.com/abc123/'), 'tiktok');
  });

  test('tiktok: m subdomain', () => {
    assert.equal(detectPlatform('https://m.tiktok.com/@user/video/123'), 'tiktok');
  });

  // YouTube Shorts
  test('youtube_shorts: standard /shorts/ path', () => {
    assert.equal(detectPlatform('https://www.youtube.com/shorts/abc123'), 'youtube_shorts');
  });

  test('youtube_shorts: no www', () => {
    assert.equal(detectPlatform('https://youtube.com/shorts/xyz'), 'youtube_shorts');
  });

  test('youtube_shorts: youtu.be short link', () => {
    assert.equal(detectPlatform('https://youtu.be/abc123'), 'youtube_shorts');
  });

  test('youtube_shorts: m.youtube.com with /shorts/', () => {
    assert.equal(detectPlatform('https://m.youtube.com/shorts/abc123'), 'youtube_shorts');
  });

  test('youtube: regular /watch?v= is NOT a short', () => {
    assert.equal(detectPlatform('https://www.youtube.com/watch?v=abc123'), null);
  });

  test('youtube: channel page is NOT a short', () => {
    assert.equal(detectPlatform('https://www.youtube.com/@channelname'), null);
  });

  // Facebook Reels
  test('facebook_reels: /reel/ path', () => {
    assert.equal(detectPlatform('https://www.facebook.com/reel/123456'), 'facebook_reels');
  });

  test('facebook_reels: no www', () => {
    assert.equal(detectPlatform('https://facebook.com/reel/123456'), 'facebook_reels');
  });

  test('facebook_reels: fb.watch domain', () => {
    assert.equal(detectPlatform('https://fb.watch/abc123/'), 'facebook_reels');
  });

  test('facebook: non-reel page returns null', () => {
    assert.equal(detectPlatform('https://www.facebook.com/someuser'), null);
  });

  // Invalid inputs
  test('returns null for plain text (invalid URL)', () => {
    assert.equal(detectPlatform('not a url'), null);
  });

  test('returns null for empty string', () => {
    assert.equal(detectPlatform(''), null);
  });

  test('returns null for unknown domain', () => {
    assert.equal(detectPlatform('https://www.instagram.com/reels/abc123'), null);
  });

  test('returns null for twitter/X', () => {
    assert.equal(detectPlatform('https://twitter.com/user/status/123'), null);
  });

  test('returns null for unrelated HTTPS URL', () => {
    assert.equal(detectPlatform('https://example.com/video/123'), null);
  });
});

describe('buildAccountProfileUrl', () => {
  // YouTube
  test('youtube: handle without @ gets @ prepended', () => {
    assert.equal(
      buildAccountProfileUrl('youtube', 'MrBeast'),
      'https://www.youtube.com/@MrBeast'
    );
  });

  test('youtube: handle with @ stays unchanged', () => {
    assert.equal(
      buildAccountProfileUrl('youtube', '@MrBeast'),
      'https://www.youtube.com/@MrBeast'
    );
  });

  // TikTok
  test('tiktok: handle without @ gets @ prepended', () => {
    assert.equal(
      buildAccountProfileUrl('tiktok', 'charlidamelio'),
      'https://www.tiktok.com/@charlidamelio'
    );
  });

  test('tiktok: handle with @ has duplicate @ stripped', () => {
    assert.equal(
      buildAccountProfileUrl('tiktok', '@charlidamelio'),
      'https://www.tiktok.com/@charlidamelio'
    );
  });

  // Instagram
  test('instagram: handle without @ gets no @ in URL', () => {
    assert.equal(
      buildAccountProfileUrl('instagram', 'natgeo'),
      'https://www.instagram.com/natgeo/'
    );
  });

  test('instagram: handle with @ strips it for URL', () => {
    assert.equal(
      buildAccountProfileUrl('instagram', '@natgeo'),
      'https://www.instagram.com/natgeo/'
    );
  });

  test('instagram: trailing slash always present', () => {
    const url = buildAccountProfileUrl('instagram', 'test');
    assert.ok(url.endsWith('/'), 'Instagram URL should end with /');
  });

  test('youtube: URL starts with https://www.youtube.com/', () => {
    const url = buildAccountProfileUrl('youtube', 'test');
    assert.ok(url.startsWith('https://www.youtube.com/'), 'YouTube URL wrong prefix');
  });

  test('tiktok: URL starts with https://www.tiktok.com/@', () => {
    const url = buildAccountProfileUrl('tiktok', 'test');
    assert.ok(url.startsWith('https://www.tiktok.com/@'), 'TikTok URL wrong prefix');
  });
});
