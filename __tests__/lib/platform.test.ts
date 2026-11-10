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

  it('detects mobile tiktok subdomain (m.tiktok.com)', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects other tiktok subdomains (vm.tiktok.com)', () => {
    expect(detectPlatform('https://vm.tiktok.com/xyz')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com shorts URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com shorts URL without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtu.be short link', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('returns null for a regular youtube.com watch URL (not /shorts/)', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('returns null for youtube.com channel page', () => {
    expect(detectPlatform('https://www.youtube.com/@channelname')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com reel', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects facebook.com reel without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects fb.watch links', () => {
    expect(detectPlatform('https://fb.watch/abc123/')).toBe('facebook_reels');
  });

  it('returns null for facebook.com non-reel page', () => {
    expect(detectPlatform('https://www.facebook.com/someuser')).toBeNull();
  });

  it('returns null for facebook.com photo', () => {
    expect(detectPlatform('https://www.facebook.com/photo?id=123')).toBeNull();
  });

  // Edge cases
  it('returns null for an invalid/non-URL string', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a totally different domain', () => {
    expect(detectPlatform('https://www.twitter.com/user/status/123')).toBeNull();
  });

  it('returns null for instagram URL', () => {
    expect(detectPlatform('https://www.instagram.com/p/xyz/')).toBeNull();
  });
});

describe('buildAccountProfileUrl', () => {
  // YouTube
  it('builds YouTube URL adding @ for handles without it', () => {
    expect(buildAccountProfileUrl('youtube', 'mkbhd')).toBe('https://www.youtube.com/@mkbhd');
  });

  it('builds YouTube URL keeping @ for handles that already have it', () => {
    expect(buildAccountProfileUrl('youtube', '@mkbhd')).toBe('https://www.youtube.com/@mkbhd');
  });

  it('builds YouTube URL for handle with numbers', () => {
    expect(buildAccountProfileUrl('youtube', 'channel123')).toBe('https://www.youtube.com/@channel123');
  });

  // TikTok
  it('builds TikTok URL stripping leading @ before adding it', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('builds TikTok URL adding @ when missing', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('builds TikTok URL for handle with dots', () => {
    expect(buildAccountProfileUrl('tiktok', 'some.user')).toBe('https://www.tiktok.com/@some.user');
  });

  // Instagram
  it('builds Instagram URL stripping leading @ before adding it', () => {
    expect(buildAccountProfileUrl('instagram', '@natgeo')).toBe('https://www.instagram.com/natgeo/');
  });

  it('builds Instagram URL when handle has no @', () => {
    expect(buildAccountProfileUrl('instagram', 'natgeo')).toBe('https://www.instagram.com/natgeo/');
  });

  it('builds Instagram URL for handle with underscores', () => {
    expect(buildAccountProfileUrl('instagram', 'some_user')).toBe('https://www.instagram.com/some_user/');
  });

  // YouTube – extra edge cases
  it('builds YouTube URL with hyphens in handle', () => {
    expect(buildAccountProfileUrl('youtube', 'my-channel')).toBe('https://www.youtube.com/@my-channel');
  });

  it('builds YouTube URL with underscores in handle', () => {
    expect(buildAccountProfileUrl('youtube', 'my_channel')).toBe('https://www.youtube.com/@my_channel');
  });

  // TikTok – extra edge cases
  it('builds TikTok URL with underscore handle', () => {
    expect(buildAccountProfileUrl('tiktok', 'some_user')).toBe('https://www.tiktok.com/@some_user');
  });

  it('builds TikTok URL with number-only handle', () => {
    expect(buildAccountProfileUrl('tiktok', '12345')).toBe('https://www.tiktok.com/@12345');
  });

  // Instagram – extra edge cases
  it('builds Instagram URL with hyphens in handle', () => {
    expect(buildAccountProfileUrl('instagram', 'my-brand')).toBe('https://www.instagram.com/my-brand/');
  });

  it('builds Instagram URL with numbers in handle', () => {
    expect(buildAccountProfileUrl('instagram', 'user42')).toBe('https://www.instagram.com/user42/');
  });
});

describe('detectPlatform – additional edge cases', () => {
  it('handles youtu.be with query params (share links)', () => {
    expect(detectPlatform('https://youtu.be/abc123?si=xyz')).toBe('youtube_shorts');
  });

  it('handles youtube.com/shorts with query params', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123?feature=share')).toBe('youtube_shorts');
  });

  it('handles facebook reel with query params', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456?s=xyz')).toBe('facebook_reels');
  });

  it('handles tiktok URL with query params', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123?lang=en')).toBe('tiktok');
  });

  it('returns null for youtube.com/watch even with shorts in query string', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc&list=shorts')).toBeNull();
  });

  it('handles m.facebook.com reel', () => {
    expect(detectPlatform('https://m.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('returns null for a URL with only a protocol', () => {
    expect(detectPlatform('https://')).toBeNull();
  });

  it('returns null for a URL with numeric IP domain', () => {
    expect(detectPlatform('https://192.168.1.1/shorts/abc')).toBeNull();
  });
});
