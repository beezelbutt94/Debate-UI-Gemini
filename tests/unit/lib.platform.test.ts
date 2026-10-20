import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform()', () => {
  // TikTok
  it('detects tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok subdomain', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc123')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com/shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtu.be short links', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('returns null for youtube.com non-shorts URL', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com/reel/', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects facebook.com/reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects fb.watch URLs', () => {
    expect(detectPlatform('https://fb.watch/abc123')).toBe('facebook_reels');
  });

  it('returns null for facebook.com non-reel URL', () => {
    expect(detectPlatform('https://www.facebook.com/photo/?fbid=123')).toBeNull();
  });

  // Invalid inputs
  it('returns null for completely invalid URL', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for unknown platform', () => {
    expect(detectPlatform('https://instagram.com/reel/abc123')).toBeNull();
  });

  it('returns null for twitter/x', () => {
    expect(detectPlatform('https://x.com/user/status/123')).toBeNull();
  });

  it('returns null for bare domain', () => {
    expect(detectPlatform('tiktok.com')).toBeNull();
  });

  it('handles youtube subdomain with shorts', () => {
    expect(detectPlatform('https://m.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('handles facebook subdomain with reel', () => {
    expect(detectPlatform('https://m.facebook.com/reel/123456')).toBe('facebook_reels');
  });
});

describe('buildAccountProfileUrl()', () => {
  // YouTube
  it('builds youtube URL with @ handle', () => {
    expect(buildAccountProfileUrl('youtube', '@creator')).toBe('https://www.youtube.com/@creator');
  });

  it('builds youtube URL without @ prefix (adds it)', () => {
    expect(buildAccountProfileUrl('youtube', 'creator')).toBe('https://www.youtube.com/@creator');
  });

  it('does not double-@ for youtube', () => {
    expect(buildAccountProfileUrl('youtube', '@creator')).toBe('https://www.youtube.com/@creator');
  });

  // TikTok
  it('builds tiktok URL without @', () => {
    expect(buildAccountProfileUrl('tiktok', 'creator')).toBe('https://www.tiktok.com/@creator');
  });

  it('builds tiktok URL stripping existing @', () => {
    expect(buildAccountProfileUrl('tiktok', '@creator')).toBe('https://www.tiktok.com/@creator');
  });

  it('does not double-@ for tiktok', () => {
    expect(buildAccountProfileUrl('tiktok', '@creator')).toBe('https://www.tiktok.com/@creator');
  });

  // Instagram
  it('builds instagram URL without trailing slash duplication', () => {
    expect(buildAccountProfileUrl('instagram', 'creator')).toBe('https://www.instagram.com/creator/');
  });

  it('builds instagram URL stripping @', () => {
    expect(buildAccountProfileUrl('instagram', '@creator')).toBe('https://www.instagram.com/creator/');
  });

  it('builds instagram URL without @ prefix', () => {
    const url = buildAccountProfileUrl('instagram', 'mrbeast');
    expect(url).toBe('https://www.instagram.com/mrbeast/');
  });

  // Edge cases
  it('handles handle with dots and underscores', () => {
    const url = buildAccountProfileUrl('tiktok', 'user.name_123');
    expect(url).toBe('https://www.tiktok.com/@user.name_123');
  });
});
