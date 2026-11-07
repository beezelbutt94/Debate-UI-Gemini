import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform', () => {
  // TikTok
  it('detects bare tiktok.com URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects subdomain of tiktok.com', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com shorts URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com shorts without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtu.be as youtube_shorts', () => {
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
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects facebook.com reel without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects fb.watch URL as facebook_reels', () => {
    expect(detectPlatform('https://fb.watch/abc123')).toBe('facebook_reels');
  });

  it('returns null for facebook.com non-reel URL', () => {
    expect(detectPlatform('https://www.facebook.com/profile')).toBeNull();
  });

  // Invalid URLs
  it('returns null for invalid URL string', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for instagram URL', () => {
    expect(detectPlatform('https://www.instagram.com/p/abc123/')).toBeNull();
  });

  it('returns null for twitter/X URL', () => {
    expect(detectPlatform('https://twitter.com/i/status/123')).toBeNull();
  });

  it('returns null for a random URL', () => {
    expect(detectPlatform('https://example.com/video/123')).toBeNull();
  });

  it('handles URL with query params for tiktok', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123?lang=en')).toBe('tiktok');
  });

  it('detects subdomain youtube shorts', () => {
    expect(detectPlatform('https://m.youtube.com/shorts/abc')).toBe('youtube_shorts');
  });

  it('detects facebook subdomain reel', () => {
    expect(detectPlatform('https://m.facebook.com/reel/123456')).toBe('facebook_reels');
  });
});

describe('buildAccountProfileUrl', () => {
  // YouTube
  it('builds youtube URL with @ prefix handle', () => {
    expect(buildAccountProfileUrl('youtube', '@myChannel')).toBe('https://www.youtube.com/@myChannel');
  });

  it('builds youtube URL for handle without @ prefix', () => {
    expect(buildAccountProfileUrl('youtube', 'myChannel')).toBe('https://www.youtube.com/@myChannel');
  });

  it('builds youtube URL and does not double-add @', () => {
    expect(buildAccountProfileUrl('youtube', '@myChannel')).toBe('https://www.youtube.com/@myChannel');
  });

  // TikTok
  it('builds tiktok URL removing leading @', () => {
    expect(buildAccountProfileUrl('tiktok', '@myUser')).toBe('https://www.tiktok.com/@myUser');
  });

  it('builds tiktok URL for handle without @', () => {
    expect(buildAccountProfileUrl('tiktok', 'myUser')).toBe('https://www.tiktok.com/@myUser');
  });

  it('tiktok does not double @ sign', () => {
    const url = buildAccountProfileUrl('tiktok', '@@weirdhandle');
    // replace(/^@/, '') removes only the first @
    expect(url).toBe('https://www.tiktok.com/@@weirdhandle');
  });

  // Instagram
  it('builds instagram URL removing leading @', () => {
    expect(buildAccountProfileUrl('instagram', '@myUser')).toBe('https://www.instagram.com/myUser/');
  });

  it('builds instagram URL for handle without @', () => {
    expect(buildAccountProfileUrl('instagram', 'myUser')).toBe('https://www.instagram.com/myUser/');
  });

  it('instagram URL always ends with trailing slash', () => {
    const url = buildAccountProfileUrl('instagram', 'user');
    expect(url.endsWith('/')).toBe(true);
  });

  it('youtube URL is correct for simple alphanumeric handle', () => {
    const url = buildAccountProfileUrl('youtube', 'creator123');
    expect(url).toBe('https://www.youtube.com/@creator123');
  });

  it('tiktok URL is correct for simple alphanumeric handle', () => {
    const url = buildAccountProfileUrl('tiktok', 'creator123');
    expect(url).toBe('https://www.tiktok.com/@creator123');
  });

  it('instagram URL is correct for simple alphanumeric handle', () => {
    const url = buildAccountProfileUrl('instagram', 'creator123');
    expect(url).toBe('https://www.instagram.com/creator123/');
  });
});
