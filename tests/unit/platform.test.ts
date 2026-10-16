import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ── detectPlatform ──────────────────────────────────────────────────────────

describe('detectPlatform()', () => {
  // TikTok
  it('detects tiktok.com video URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects bare tiktok.com (no www)', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok subdomain (e.g. vm.tiktok.com)', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc123')).toBe('tiktok');
  });

  it('detects tiktok m. subdomain', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com shorts URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com shorts without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/xyz')).toBe('youtube_shorts');
  });

  it('detects youtu.be short link', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('returns null for youtube.com non-shorts URL', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('returns null for youtube.com channel URL', () => {
    expect(detectPlatform('https://www.youtube.com/@channel')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com reel URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('detects facebook.com reel without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('detects fb.watch short link', () => {
    expect(detectPlatform('https://fb.watch/abc123')).toBe('facebook_reels');
  });

  it('returns null for facebook.com non-reel URL', () => {
    expect(detectPlatform('https://www.facebook.com/photo/123456789')).toBeNull();
  });

  it('returns null for facebook.com post URL', () => {
    expect(detectPlatform('https://www.facebook.com/groups/some-group/posts/123')).toBeNull();
  });

  // Unknown / invalid
  it('returns null for an unrecognized domain', () => {
    expect(detectPlatform('https://instagram.com/p/abc')).toBeNull();
  });

  it('returns null for a completely invalid URL', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a bare domain without protocol', () => {
    expect(detectPlatform('tiktok.com/@user/video/123')).toBeNull();
  });

  it('returns null for twitter URL', () => {
    expect(detectPlatform('https://twitter.com/i/status/123')).toBeNull();
  });

  it('returns null for snapchat spotlight URL', () => {
    expect(detectPlatform('https://www.snapchat.com/spotlight/abc')).toBeNull();
  });
});

// ── buildAccountProfileUrl ──────────────────────────────────────────────────

describe('buildAccountProfileUrl()', () => {
  // YouTube
  it('builds youtube URL from handle with @ prefix', () => {
    expect(buildAccountProfileUrl('youtube', '@creator')).toBe('https://www.youtube.com/@creator');
  });

  it('builds youtube URL from handle without @ prefix (adds @)', () => {
    expect(buildAccountProfileUrl('youtube', 'creator')).toBe('https://www.youtube.com/@creator');
  });

  it('does not double-add @ for youtube', () => {
    expect(buildAccountProfileUrl('youtube', '@already')).toBe('https://www.youtube.com/@already');
  });

  // TikTok
  it('builds tiktok URL from handle with @ prefix (strips extra @)', () => {
    expect(buildAccountProfileUrl('tiktok', '@creator')).toBe('https://www.tiktok.com/@creator');
  });

  it('builds tiktok URL from handle without @ prefix', () => {
    expect(buildAccountProfileUrl('tiktok', 'creator')).toBe('https://www.tiktok.com/@creator');
  });

  it('does not double-@ for tiktok', () => {
    expect(buildAccountProfileUrl('tiktok', '@handle')).toBe('https://www.tiktok.com/@handle');
  });

  // Instagram
  it('builds instagram URL from handle with @ prefix (strips @)', () => {
    expect(buildAccountProfileUrl('instagram', '@creator')).toBe('https://www.instagram.com/creator/');
  });

  it('builds instagram URL from handle without @', () => {
    expect(buildAccountProfileUrl('instagram', 'creator')).toBe('https://www.instagram.com/creator/');
  });

  it('instagram URL ends with trailing slash', () => {
    const url = buildAccountProfileUrl('instagram', 'test');
    expect(url.endsWith('/')).toBe(true);
  });

  // Edge cases
  it('handles numeric-looking handles for tiktok', () => {
    expect(buildAccountProfileUrl('tiktok', '123abc')).toBe('https://www.tiktok.com/@123abc');
  });

  it('handles handle with dots for youtube', () => {
    expect(buildAccountProfileUrl('youtube', 'my.channel')).toBe('https://www.youtube.com/@my.channel');
  });
});
