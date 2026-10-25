import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform', () => {
  // TikTok
  it('detects tiktok.com URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/12345')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/12345')).toBe('tiktok');
  });

  it('detects subdomain of tiktok.com', () => {
    expect(detectPlatform('https://vm.tiktok.com/ZMFake123/')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com/shorts URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtu.be URL', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('returns null for youtube.com non-shorts URL', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com/reel URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/12345')).toBe('facebook_reels');
  });

  it('detects facebook.com/reel without www', () => {
    expect(detectPlatform('https://facebook.com/reel/12345')).toBe('facebook_reels');
  });

  it('detects fb.watch URL', () => {
    expect(detectPlatform('https://fb.watch/someShortCode')).toBe('facebook_reels');
  });

  it('returns null for facebook.com non-reel URL', () => {
    expect(detectPlatform('https://www.facebook.com/groups/mygroup')).toBeNull();
  });

  // Unknown / invalid
  it('returns null for unknown domain', () => {
    expect(detectPlatform('https://instagram.com/reel/abc')).toBeNull();
  });

  it('returns null for invalid URL', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for plain text', () => {
    expect(detectPlatform('tiktok.com/@user')).toBeNull();
  });

  it('detects subdomain of youtube.com with /shorts/', () => {
    expect(detectPlatform('https://m.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects subdomain of facebook.com with /reel/', () => {
    expect(detectPlatform('https://m.facebook.com/reel/67890')).toBe('facebook_reels');
  });
});

describe('buildAccountProfileUrl', () => {
  // YouTube
  it('builds youtube URL with @ handle', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('builds youtube URL without @ (adds it)', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('does not double-add @ for youtube', () => {
    expect(buildAccountProfileUrl('youtube', '@user')).toBe('https://www.youtube.com/@user');
  });

  // TikTok
  it('builds tiktok URL without @ prefix', () => {
    expect(buildAccountProfileUrl('tiktok', 'user123')).toBe('https://www.tiktok.com/@user123');
  });

  it('builds tiktok URL stripping leading @', () => {
    expect(buildAccountProfileUrl('tiktok', '@user123')).toBe('https://www.tiktok.com/@user123');
  });

  it('does not double-add @ for tiktok', () => {
    expect(buildAccountProfileUrl('tiktok', '@creator')).toBe('https://www.tiktok.com/@creator');
  });

  // Instagram
  it('builds instagram URL without @ prefix', () => {
    expect(buildAccountProfileUrl('instagram', 'user')).toBe('https://www.instagram.com/user/');
  });

  it('strips leading @ from instagram handle', () => {
    expect(buildAccountProfileUrl('instagram', '@user')).toBe('https://www.instagram.com/user/');
  });

  it('does not double-add @ for instagram', () => {
    expect(buildAccountProfileUrl('instagram', '@creator')).toBe('https://www.instagram.com/creator/');
  });

  // Edge cases
  it('handles handles with dots (youtube)', () => {
    expect(buildAccountProfileUrl('youtube', 'user.name')).toBe('https://www.youtube.com/@user.name');
  });

  it('handles handles with dots (tiktok)', () => {
    expect(buildAccountProfileUrl('tiktok', 'user.name')).toBe('https://www.tiktok.com/@user.name');
  });
});
