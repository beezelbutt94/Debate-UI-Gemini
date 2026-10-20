import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform', () => {
  // TikTok
  it('detects tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects subdomain of tiktok.com', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com/shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtu.be short link', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('rejects youtube.com without /shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com/reel/', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects facebook.com/reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects fb.watch', () => {
    expect(detectPlatform('https://fb.watch/abc123')).toBe('facebook_reels');
  });

  it('rejects facebook.com without /reel/', () => {
    expect(detectPlatform('https://www.facebook.com/someprofile')).toBeNull();
  });

  // Invalid URLs
  it('returns null for invalid URL', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for unknown platform', () => {
    expect(detectPlatform('https://instagram.com/reel/abc')).toBeNull();
  });

  it('returns null for twitter.com', () => {
    expect(detectPlatform('https://twitter.com/status/123')).toBeNull();
  });

  it('handles subdomain of youtube.com with shorts', () => {
    expect(detectPlatform('https://m.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('handles subdomain of facebook.com with reel', () => {
    expect(detectPlatform('https://m.facebook.com/reel/123456')).toBe('facebook_reels');
  });
});

describe('buildAccountProfileUrl', () => {
  // YouTube
  it('builds youtube URL with @handle', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('builds youtube URL adding @ when missing', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('does not double @@ for youtube', () => {
    expect(buildAccountProfileUrl('youtube', '@Creator')).toBe('https://www.youtube.com/@Creator');
  });

  // TikTok
  it('builds tiktok URL stripping leading @', () => {
    expect(buildAccountProfileUrl('tiktok', '@user')).toBe('https://www.tiktok.com/@user');
  });

  it('builds tiktok URL adding @ when missing', () => {
    expect(buildAccountProfileUrl('tiktok', 'user')).toBe('https://www.tiktok.com/@user');
  });

  it('does not double @ for tiktok', () => {
    expect(buildAccountProfileUrl('tiktok', '@username')).toBe('https://www.tiktok.com/@username');
  });

  // Instagram
  it('builds instagram URL stripping leading @', () => {
    expect(buildAccountProfileUrl('instagram', '@photos')).toBe('https://www.instagram.com/photos/');
  });

  it('builds instagram URL adding trailing slash when no @', () => {
    expect(buildAccountProfileUrl('instagram', 'photos')).toBe('https://www.instagram.com/photos/');
  });

  it('does not double @ for instagram', () => {
    expect(buildAccountProfileUrl('instagram', '@user')).toBe('https://www.instagram.com/user/');
  });
});
