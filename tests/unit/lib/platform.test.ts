import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform()', () => {
  // TikTok
  it('detects tiktok.com URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@creator/video/123456')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@creator/video/123456')).toBe('tiktok');
  });

  it('detects tiktok subdomain (vm.tiktok.com)', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc123/')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com/shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtu.be short link as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('returns null for youtube.com watch (not shorts)', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('returns null for youtube.com channel page', () => {
    expect(detectPlatform('https://www.youtube.com/@channel')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com/reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects facebook.com/reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects fb.watch short link as facebook_reels', () => {
    expect(detectPlatform('https://fb.watch/abc123/')).toBe('facebook_reels');
  });

  it('returns null for facebook.com non-reel page', () => {
    expect(detectPlatform('https://www.facebook.com/someone/posts/123')).toBeNull();
  });

  // Invalid inputs
  it('returns null for completely invalid URL string', () => {
    expect(detectPlatform('not-a-url-at-all')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for unknown platform URL', () => {
    expect(detectPlatform('https://www.instagram.com/p/abc123/')).toBeNull();
  });

  it('returns null for twitter/X URL', () => {
    expect(detectPlatform('https://twitter.com/someone/status/123')).toBeNull();
  });

  it('handles URL with no scheme (invalid URL)', () => {
    expect(detectPlatform('tiktok.com/@creator')).toBeNull();
  });

  it('detects m.tiktok.com (mobile subdomain)', () => {
    expect(detectPlatform('https://m.tiktok.com/@creator/video/123')).toBe('tiktok');
  });

  it('detects m.facebook.com reel', () => {
    expect(detectPlatform('https://m.facebook.com/reel/123456')).toBe('facebook_reels');
  });
});

describe('buildAccountProfileUrl()', () => {
  // YouTube
  it('builds YouTube URL for handle with @ prefix', () => {
    expect(buildAccountProfileUrl('youtube', '@creator')).toBe('https://www.youtube.com/@creator');
  });

  it('builds YouTube URL for handle without @ prefix (adds it)', () => {
    expect(buildAccountProfileUrl('youtube', 'creator')).toBe('https://www.youtube.com/@creator');
  });

  it('builds YouTube URL and does not double @', () => {
    expect(buildAccountProfileUrl('youtube', '@@creator')).toBe('https://www.youtube.com/@@creator');
  });

  // TikTok
  it('builds TikTok URL for handle without @ prefix', () => {
    expect(buildAccountProfileUrl('tiktok', 'creator')).toBe('https://www.tiktok.com/@creator');
  });

  it('builds TikTok URL for handle with @ prefix (strips it then re-adds)', () => {
    expect(buildAccountProfileUrl('tiktok', '@creator')).toBe('https://www.tiktok.com/@creator');
  });

  // Instagram
  it('builds Instagram URL for handle without @ prefix', () => {
    expect(buildAccountProfileUrl('instagram', 'creator')).toBe('https://www.instagram.com/creator/');
  });

  it('builds Instagram URL for handle with @ prefix (strips it)', () => {
    expect(buildAccountProfileUrl('instagram', '@creator')).toBe('https://www.instagram.com/creator/');
  });

  it('builds Instagram URL for handle with mixed case', () => {
    expect(buildAccountProfileUrl('instagram', 'Creator123')).toBe('https://www.instagram.com/Creator123/');
  });
});
