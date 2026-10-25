import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { detectPlatform, buildAccountProfileUrl } from '../../lib/platform.ts';

// ── detectPlatform ─────────────────────────────────────────────────────────

describe('detectPlatform()', () => {
  // TikTok
  test('detects tiktok.com URL', () => {
    assert.equal(detectPlatform('https://www.tiktok.com/@creator/video/123'), 'tiktok');
  });

  test('detects tiktok.com without www', () => {
    assert.equal(detectPlatform('https://tiktok.com/@creator/video/123'), 'tiktok');
  });

  test('detects subdomain of tiktok.com (e.g. vt.tiktok.com)', () => {
    assert.equal(detectPlatform('https://vt.tiktok.com/video/123456'), 'tiktok');
  });

  test('detects vm.tiktok.com short link', () => {
    assert.equal(detectPlatform('https://vm.tiktok.com/abcdef/'), 'tiktok');
  });

  // YouTube Shorts
  test('detects youtube.com /shorts/ URL', () => {
    assert.equal(detectPlatform('https://www.youtube.com/shorts/abc123'), 'youtube_shorts');
  });

  test('detects youtube.com/shorts without www', () => {
    assert.equal(detectPlatform('https://youtube.com/shorts/abc123'), 'youtube_shorts');
  });

  test('detects youtu.be short link as youtube_shorts', () => {
    assert.equal(detectPlatform('https://youtu.be/abc123'), 'youtube_shorts');
  });

  test('returns null for regular youtube.com video (not /shorts/)', () => {
    assert.equal(detectPlatform('https://www.youtube.com/watch?v=abc123'), null);
  });

  test('returns null for youtube.com channel page', () => {
    assert.equal(detectPlatform('https://www.youtube.com/@channel'), null);
  });

  // Facebook Reels
  test('detects facebook.com /reel/ URL', () => {
    assert.equal(detectPlatform('https://www.facebook.com/reel/123456'), 'facebook_reels');
  });

  test('detects facebook.com /reel/ without www', () => {
    assert.equal(detectPlatform('https://facebook.com/reel/123456'), 'facebook_reels');
  });

  test('detects m.facebook.com /reel/ URL', () => {
    assert.equal(detectPlatform('https://m.facebook.com/reel/123456'), 'facebook_reels');
  });

  test('detects fb.watch URL', () => {
    assert.equal(detectPlatform('https://fb.watch/abcdefg/'), 'facebook_reels');
  });

  test('returns null for facebook.com regular post (no /reel/)', () => {
    assert.equal(detectPlatform('https://www.facebook.com/posts/123456'), null);
  });

  // Invalid / unknown
  test('returns null for unknown domain', () => {
    assert.equal(detectPlatform('https://instagram.com/reel/abc123'), null);
  });

  test('returns null for malformed URL', () => {
    assert.equal(detectPlatform('not-a-url'), null);
  });

  test('returns null for empty string', () => {
    assert.equal(detectPlatform(''), null);
  });

  test('returns null for twitter/X URL', () => {
    assert.equal(detectPlatform('https://twitter.com/status/123'), null);
  });

  test('returns null for random http URL', () => {
    assert.equal(detectPlatform('http://example.com/video'), null);
  });
});

// ── buildAccountProfileUrl ─────────────────────────────────────────────────

describe('buildAccountProfileUrl()', () => {
  // YouTube
  test('youtube: adds @ prefix when missing', () => {
    assert.equal(
      buildAccountProfileUrl('youtube', 'mychannel'),
      'https://www.youtube.com/@mychannel'
    );
  });

  test('youtube: preserves @ prefix when present', () => {
    assert.equal(
      buildAccountProfileUrl('youtube', '@mychannel'),
      'https://www.youtube.com/@mychannel'
    );
  });

  test('youtube: handles handle with dots', () => {
    assert.equal(
      buildAccountProfileUrl('youtube', 'my.channel'),
      'https://www.youtube.com/@my.channel'
    );
  });

  // TikTok
  test('tiktok: adds @ prefix when missing', () => {
    assert.equal(
      buildAccountProfileUrl('tiktok', 'creator'),
      'https://www.tiktok.com/@creator'
    );
  });

  test('tiktok: strips leading @ before adding it back', () => {
    assert.equal(
      buildAccountProfileUrl('tiktok', '@creator'),
      'https://www.tiktok.com/@creator'
    );
  });

  test('tiktok: handles underscore in handle', () => {
    assert.equal(
      buildAccountProfileUrl('tiktok', 'my_creator'),
      'https://www.tiktok.com/@my_creator'
    );
  });

  // Instagram
  test('instagram: strips leading @ and builds URL', () => {
    assert.equal(
      buildAccountProfileUrl('instagram', '@gramcreator'),
      'https://www.instagram.com/gramcreator/'
    );
  });

  test('instagram: adds no extra @ when handle has none', () => {
    assert.equal(
      buildAccountProfileUrl('instagram', 'gramcreator'),
      'https://www.instagram.com/gramcreator/'
    );
  });

  test('instagram: URL ends with trailing slash', () => {
    const url = buildAccountProfileUrl('instagram', 'test');
    assert.ok(url.endsWith('/'), `Expected trailing slash, got: ${url}`);
  });

  test('youtube URL is on www.youtube.com', () => {
    const url = buildAccountProfileUrl('youtube', 'chan');
    assert.ok(url.startsWith('https://www.youtube.com/'), url);
  });

  test('tiktok URL is on www.tiktok.com', () => {
    const url = buildAccountProfileUrl('tiktok', 'chan');
    assert.ok(url.startsWith('https://www.tiktok.com/'), url);
  });

  test('instagram URL is on www.instagram.com', () => {
    const url = buildAccountProfileUrl('instagram', 'chan');
    assert.ok(url.startsWith('https://www.instagram.com/'), url);
  });
});
