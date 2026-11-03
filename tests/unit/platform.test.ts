import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform()', () => {
  // TikTok
  it('identifies tiktok.com URLs', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('identifies tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('identifies tiktok subdomains (e.g. vm.tiktok.com)', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc123')).toBe('tiktok');
  });

  it('identifies tiktok with http scheme', () => {
    expect(detectPlatform('http://tiktok.com/@user/video/456')).toBe('tiktok');
  });

  // YouTube Shorts
  it('identifies youtube.com/shorts/ URLs', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abcDEF123')).toBe('youtube_shorts');
  });

  it('identifies youtube.com/shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abcDEF123')).toBe('youtube_shorts');
  });

  it('identifies youtu.be short links as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/abcDEF123')).toBe('youtube_shorts');
  });

  it('returns null for youtube.com watch URLs (not shorts)', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc')).toBeNull();
  });

  it('returns null for youtube.com channel URLs', () => {
    expect(detectPlatform('https://www.youtube.com/@creator')).toBeNull();
  });

  it('identifies youtube subdomain shorts', () => {
    expect(detectPlatform('https://music.youtube.com/shorts/abc')).toBe('youtube_shorts');
  });

  // Facebook Reels
  it('identifies facebook.com/reel/ URLs', () => {
    expect(detectPlatform('https://www.facebook.com/reel/12345')).toBe('facebook_reels');
  });

  it('identifies facebook.com/reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/12345')).toBe('facebook_reels');
  });

  it('identifies fb.watch URLs', () => {
    expect(detectPlatform('https://fb.watch/abc123/')).toBe('facebook_reels');
  });

  it('returns null for facebook.com non-reel URLs', () => {
    expect(detectPlatform('https://www.facebook.com/profile/12345')).toBeNull();
  });

  it('identifies facebook subdomain reel URLs', () => {
    expect(detectPlatform('https://m.facebook.com/reel/99999')).toBe('facebook_reels');
  });

  // Invalid / other
  it('returns null for a non-supported domain', () => {
    expect(detectPlatform('https://instagram.com/reel/abc')).toBeNull();
  });

  it('returns null for a completely invalid string', () => {
    expect(detectPlatform('not a url at all')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a URL with no meaningful path (twitter.com)', () => {
    expect(detectPlatform('https://twitter.com/i/status/123')).toBeNull();
  });

  it('returns null for plain http with no recognisable host', () => {
    expect(detectPlatform('http://')).toBeNull();
  });
});

describe('buildAccountProfileUrl()', () => {
  // YouTube
  it('prepends @ for a bare YouTube handle', () => {
    expect(buildAccountProfileUrl('youtube', 'creator')).toBe('https://www.youtube.com/@creator');
  });

  it('does not double-@ for a YouTube handle already starting with @', () => {
    expect(buildAccountProfileUrl('youtube', '@creator')).toBe('https://www.youtube.com/@creator');
  });

  it('handles YouTube handles with numbers and underscores', () => {
    expect(buildAccountProfileUrl('youtube', 'channel_123')).toBe('https://www.youtube.com/@channel_123');
  });

  // TikTok
  it('prepends @ for a bare TikTok handle', () => {
    expect(buildAccountProfileUrl('tiktok', 'creator')).toBe('https://www.tiktok.com/@creator');
  });

  it('strips leading @ before prepending for TikTok', () => {
    expect(buildAccountProfileUrl('tiktok', '@creator')).toBe('https://www.tiktok.com/@creator');
  });

  it('handles TikTok handles with dots', () => {
    expect(buildAccountProfileUrl('tiktok', 'creator.name')).toBe('https://www.tiktok.com/@creator.name');
  });

  // Instagram
  it('builds a correct Instagram URL for a bare handle', () => {
    expect(buildAccountProfileUrl('instagram', 'creator')).toBe('https://www.instagram.com/creator/');
  });

  it('strips leading @ for Instagram handle', () => {
    expect(buildAccountProfileUrl('instagram', '@creator')).toBe('https://www.instagram.com/creator/');
  });

  it('preserves trailing slash in Instagram URL', () => {
    const url = buildAccountProfileUrl('instagram', 'test');
    expect(url.endsWith('/')).toBe(true);
  });

  it('handles handles with mixed case', () => {
    expect(buildAccountProfileUrl('instagram', 'MyHandle')).toBe('https://www.instagram.com/MyHandle/');
  });
});
