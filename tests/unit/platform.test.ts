import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform()', () => {
  // TikTok
  it('detects tiktok.com URLs', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123456')).toBe('tiktok');
  });

  it('detects bare tiktok.com (no www)', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects subdomain tiktok URLs', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc123')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com/shorts/ URLs', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtu.be URLs as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('does NOT detect regular youtube.com watch URLs', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('does NOT detect youtube channel URLs', () => {
    expect(detectPlatform('https://www.youtube.com/@channel')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com/reel/ URLs', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('detects fb.watch URLs', () => {
    expect(detectPlatform('https://fb.watch/abc123/')).toBe('facebook_reels');
  });

  it('does NOT detect regular facebook.com URLs', () => {
    expect(detectPlatform('https://www.facebook.com/profile/me')).toBeNull();
  });

  // Invalid/unknown
  it('returns null for invalid URLs', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for unknown domain', () => {
    expect(detectPlatform('https://instagram.com/p/abc')).toBeNull();
  });

  it('returns null for twitter.com', () => {
    expect(detectPlatform('https://twitter.com/i/status/123')).toBeNull();
  });

  it('handles subdomain facebook URLs with reel path', () => {
    expect(detectPlatform('https://m.facebook.com/reel/123456')).toBe('facebook_reels');
  });
});

describe('buildAccountProfileUrl()', () => {
  // YouTube
  it('builds youtube URL with @ handle', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('builds youtube URL without @ (adds it)', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  // TikTok
  it('builds tiktok URL stripping leading @', () => {
    expect(buildAccountProfileUrl('tiktok', '@creator')).toBe('https://www.tiktok.com/@creator');
  });

  it('builds tiktok URL adding @ when missing', () => {
    expect(buildAccountProfileUrl('tiktok', 'creator')).toBe('https://www.tiktok.com/@creator');
  });

  // Instagram
  it('builds instagram URL stripping leading @', () => {
    expect(buildAccountProfileUrl('instagram', '@influencer')).toBe('https://www.instagram.com/influencer/');
  });

  it('builds instagram URL without @', () => {
    expect(buildAccountProfileUrl('instagram', 'influencer')).toBe('https://www.instagram.com/influencer/');
  });

  it('youtube URL is stable for handle already with @', () => {
    const url = buildAccountProfileUrl('youtube', '@handle');
    expect(url).toBe('https://www.youtube.com/@handle');
  });

  it('tiktok does not double-prefix @', () => {
    const url = buildAccountProfileUrl('tiktok', '@user');
    expect(url.split('@')).toHaveLength(2); // exactly one @
  });
});
