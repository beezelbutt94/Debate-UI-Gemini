import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform()', () => {
  // ── TikTok ─────────────────────────────────────────────────────────────
  it('detects tiktok.com video URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects bare tiktok.com (no www)', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok subdomain (vm.tiktok.com)', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc123/')).toBe('tiktok');
  });

  it('detects tiktok subdomain (m.tiktok.com)', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  // ── YouTube Shorts ──────────────────────────────────────────────────────
  it('detects youtube.com/shorts URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtu.be short URL', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('does NOT detect regular youtube.com watch URL', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('does NOT detect youtube.com channel URL', () => {
    expect(detectPlatform('https://www.youtube.com/@channel')).toBeNull();
  });

  // ── Facebook Reels ──────────────────────────────────────────────────────
  it('detects facebook.com/reel URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('detects facebook.com/reel without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('detects fb.watch URL', () => {
    expect(detectPlatform('https://fb.watch/abc123/')).toBe('facebook_reels');
  });

  it('does NOT detect regular facebook.com post', () => {
    expect(detectPlatform('https://www.facebook.com/someuser/posts/123')).toBeNull();
  });

  it('detects facebook subdomain reel', () => {
    expect(detectPlatform('https://m.facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  // ── Invalid / unknown ───────────────────────────────────────────────────
  it('returns null for invalid URL', () => {
    expect(detectPlatform('not a url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for unknown platform', () => {
    expect(detectPlatform('https://instagram.com/reel/abc')).toBeNull();
  });

  it('returns null for twitter URL', () => {
    expect(detectPlatform('https://twitter.com/user/status/123')).toBeNull();
  });

  it('returns null for bare domain with no path', () => {
    expect(detectPlatform('https://vimeo.com/123456')).toBeNull();
  });

  it('handles URL with query params for tiktok', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123?is_from_webapp=1')).toBe('tiktok');
  });

  it('handles URL with fragment for youtube shorts', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123#t=5')).toBe('youtube_shorts');
  });
});

describe('buildAccountProfileUrl()', () => {
  // ── YouTube ─────────────────────────────────────────────────────────────
  it('builds youtube URL with @ handle', () => {
    expect(buildAccountProfileUrl('youtube', '@creator')).toBe('https://www.youtube.com/@creator');
  });

  it('builds youtube URL for handle without @ prefix (adds @)', () => {
    expect(buildAccountProfileUrl('youtube', 'creator')).toBe('https://www.youtube.com/@creator');
  });

  it('does not double-add @ for youtube', () => {
    expect(buildAccountProfileUrl('youtube', '@creator')).toBe('https://www.youtube.com/@creator');
  });

  // ── TikTok ──────────────────────────────────────────────────────────────
  it('builds tiktok URL with @ stripped', () => {
    expect(buildAccountProfileUrl('tiktok', '@creator')).toBe('https://www.tiktok.com/@creator');
  });

  it('builds tiktok URL for handle without @ prefix', () => {
    expect(buildAccountProfileUrl('tiktok', 'creator')).toBe('https://www.tiktok.com/@creator');
  });

  it('does not double-@ for tiktok', () => {
    expect(buildAccountProfileUrl('tiktok', '@@creator')).toBe('https://www.tiktok.com/@@creator');
  });

  // ── Instagram ───────────────────────────────────────────────────────────
  it('builds instagram URL with @ stripped', () => {
    expect(buildAccountProfileUrl('instagram', '@creator')).toBe('https://www.instagram.com/creator/');
  });

  it('builds instagram URL for handle without @', () => {
    expect(buildAccountProfileUrl('instagram', 'creator')).toBe('https://www.instagram.com/creator/');
  });

  it('strips leading @ from instagram handle', () => {
    expect(buildAccountProfileUrl('instagram', '@myhandle')).toBe('https://www.instagram.com/myhandle/');
  });

  // ── Edge cases ──────────────────────────────────────────────────────────
  it('handles handles with dots and underscores (youtube)', () => {
    expect(buildAccountProfileUrl('youtube', 'creator.name_123')).toBe('https://www.youtube.com/@creator.name_123');
  });

  it('handles handles with dots and underscores (instagram)', () => {
    expect(buildAccountProfileUrl('instagram', 'creator.name_123')).toBe('https://www.instagram.com/creator.name_123/');
  });
});
