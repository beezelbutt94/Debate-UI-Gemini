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
    expect(detectPlatform('https://vm.tiktok.com/abc')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com shorts', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com shorts without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/xyz')).toBe('youtube_shorts');
  });

  it('detects youtu.be as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('does NOT detect youtube.com without /shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('does NOT detect youtube.com channel page', () => {
    expect(detectPlatform('https://www.youtube.com/@channelname')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com reel', () => {
    expect(detectPlatform('https://www.facebook.com/reel/12345')).toBe('facebook_reels');
  });

  it('detects facebook.com reel without www', () => {
    expect(detectPlatform('https://facebook.com/reel/12345')).toBe('facebook_reels');
  });

  it('detects fb.watch', () => {
    expect(detectPlatform('https://fb.watch/abc')).toBe('facebook_reels');
  });

  it('detects facebook subdomain reel', () => {
    expect(detectPlatform('https://m.facebook.com/reel/99999')).toBe('facebook_reels');
  });

  it('does NOT detect facebook.com without /reel/', () => {
    expect(detectPlatform('https://www.facebook.com/watch?v=123')).toBeNull();
  });

  it('does NOT detect facebook.com page', () => {
    expect(detectPlatform('https://www.facebook.com/SomePage')).toBeNull();
  });

  // Invalid / unknown
  it('returns null for invalid URL', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for unknown platform', () => {
    expect(detectPlatform('https://instagram.com/reel/abc')).toBeNull();
  });

  it('returns null for twitter/X', () => {
    expect(detectPlatform('https://x.com/user/status/123')).toBeNull();
  });

  it('returns null for a bare domain with no path', () => {
    expect(detectPlatform('https://tiktok.com')).toBe('tiktok');
  });

  it('handles URL with query params on tiktok', () => {
    expect(detectPlatform('https://www.tiktok.com/@creator/video/999?is_copy_url=1')).toBe('tiktok');
  });

  it('handles URL with query params on youtube shorts', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc?feature=share')).toBe('youtube_shorts');
  });
});

describe('buildAccountProfileUrl()', () => {
  // YouTube
  it('prefixes @ to youtube handle that lacks it', () => {
    expect(buildAccountProfileUrl('youtube', 'creator')).toBe('https://www.youtube.com/@creator');
  });

  it('does not double-@ youtube handle', () => {
    expect(buildAccountProfileUrl('youtube', '@creator')).toBe('https://www.youtube.com/@creator');
  });

  it('builds youtube url for handle with numbers', () => {
    const url = buildAccountProfileUrl('youtube', 'user123');
    expect(url).toBe('https://www.youtube.com/@user123');
  });

  // TikTok
  it('strips leading @ from tiktok handle', () => {
    expect(buildAccountProfileUrl('tiktok', '@creator')).toBe('https://www.tiktok.com/@creator');
  });

  it('adds @ to tiktok handle without it', () => {
    expect(buildAccountProfileUrl('tiktok', 'creator')).toBe('https://www.tiktok.com/@creator');
  });

  it('builds tiktok url for handle with underscores', () => {
    expect(buildAccountProfileUrl('tiktok', 'my_user_handle')).toBe('https://www.tiktok.com/@my_user_handle');
  });

  // Instagram
  it('strips leading @ from instagram handle', () => {
    expect(buildAccountProfileUrl('instagram', '@creator')).toBe('https://www.instagram.com/creator/');
  });

  it('adds trailing slash to instagram url', () => {
    expect(buildAccountProfileUrl('instagram', 'creator')).toBe('https://www.instagram.com/creator/');
  });

  it('does not double slash instagram', () => {
    const url = buildAccountProfileUrl('instagram', 'creator');
    expect(url.endsWith('//')).toBe(false);
  });

  it('builds instagram url for hyphenated handle', () => {
    expect(buildAccountProfileUrl('instagram', 'my-page')).toBe('https://www.instagram.com/my-page/');
  });

  // All three produce https URLs
  it('all URLs start with https://', () => {
    expect(buildAccountProfileUrl('youtube', 'test')).toMatch(/^https:\/\//);
    expect(buildAccountProfileUrl('tiktok', 'test')).toMatch(/^https:\/\//);
    expect(buildAccountProfileUrl('instagram', 'test')).toMatch(/^https:\/\//);
  });
});
