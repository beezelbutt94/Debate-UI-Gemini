import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ─── detectPlatform ─────────────────────────────────────────────────────────

describe('detectPlatform', () => {
  // TikTok
  it('detects tiktok.com URLs', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects bare tiktok.com (no www)', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects TikTok subdomain URLs', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc123/')).toBe('tiktok');
  });

  it('detects TikTok with http scheme', () => {
    expect(detectPlatform('http://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects TikTok share URLs', () => {
    expect(detectPlatform('https://m.tiktok.com/v/7123456789.html')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com /shorts/ URLs', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com /shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtu.be short links', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube subdomain with /shorts/', () => {
    expect(detectPlatform('https://m.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('returns null for youtube.com URLs without /shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('returns null for youtube.com channel URLs', () => {
    expect(detectPlatform('https://www.youtube.com/@channelname')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com /reel/ URLs', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects facebook.com /reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects fb.watch URLs', () => {
    expect(detectPlatform('https://fb.watch/abc123/')).toBe('facebook_reels');
  });

  it('detects Facebook subdomain with /reel/', () => {
    expect(detectPlatform('https://m.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('returns null for facebook.com without /reel/', () => {
    expect(detectPlatform('https://www.facebook.com/video/123456')).toBeNull();
  });

  it('returns null for facebook.com profile page', () => {
    expect(detectPlatform('https://www.facebook.com/someuser')).toBeNull();
  });

  // Invalid / unknown
  it('returns null for completely invalid URLs', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for Instagram URLs', () => {
    expect(detectPlatform('https://www.instagram.com/p/abc123/')).toBeNull();
  });

  it('returns null for Twitter/X URLs', () => {
    expect(detectPlatform('https://twitter.com/user/status/123')).toBeNull();
  });

  it('returns null for arbitrary domains', () => {
    expect(detectPlatform('https://example.com/shorts/abc')).toBeNull();
  });

  it('returns null for URLs that look like tiktok but have different domain', () => {
    expect(detectPlatform('https://notatiktok.com/@user/video/123')).toBeNull();
  });

  it('returns null for a URL with only a scheme', () => {
    expect(detectPlatform('https://')).toBeNull();
  });

  it('handles URL with query params correctly for TikTok', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123?is_from_webapp=1')).toBe('tiktok');
  });

  it('handles YouTube /shorts/ URL with query params', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc?feature=share')).toBe('youtube_shorts');
  });

  it('handles Facebook reel URL with query params', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456?s=abc')).toBe('facebook_reels');
  });
});

// ─── buildAccountProfileUrl ──────────────────────────────────────────────────

describe('buildAccountProfileUrl', () => {
  // YouTube
  it('builds a YouTube URL for a handle that already has @', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('builds a YouTube URL for a bare handle (no @)', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('builds a YouTube URL for a lowercase handle', () => {
    expect(buildAccountProfileUrl('youtube', 'creator')).toBe('https://www.youtube.com/@creator');
  });

  it('does not double-add @ to YouTube handle', () => {
    const url = buildAccountProfileUrl('youtube', '@creator');
    expect(url).toBe('https://www.youtube.com/@creator');
    expect(url).not.toContain('@@');
  });

  // TikTok
  it('builds a TikTok URL for a bare handle', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('strips leading @ from TikTok handle', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('does not double-add @ to TikTok handle', () => {
    const url = buildAccountProfileUrl('tiktok', '@user');
    expect(url).not.toContain('@@');
  });

  it('builds TikTok URL with numeric handle', () => {
    expect(buildAccountProfileUrl('tiktok', 'user123')).toBe('https://www.tiktok.com/@user123');
  });

  // Instagram
  it('builds an Instagram URL for a bare handle', () => {
    expect(buildAccountProfileUrl('instagram', 'natgeo')).toBe('https://www.instagram.com/natgeo/');
  });

  it('strips leading @ from Instagram handle', () => {
    expect(buildAccountProfileUrl('instagram', '@natgeo')).toBe('https://www.instagram.com/natgeo/');
  });

  it('Instagram URL ends with a trailing slash', () => {
    const url = buildAccountProfileUrl('instagram', 'someuser');
    expect(url.endsWith('/')).toBe(true);
  });

  it('Instagram URL does not contain @', () => {
    const url = buildAccountProfileUrl('instagram', '@someuser');
    expect(url).not.toContain('@');
  });

  // Structure checks
  it('YouTube URL starts with https://www.youtube.com/', () => {
    expect(buildAccountProfileUrl('youtube', 'user')).toMatch(/^https:\/\/www\.youtube\.com\//);
  });

  it('TikTok URL starts with https://www.tiktok.com/@', () => {
    expect(buildAccountProfileUrl('tiktok', 'user')).toMatch(/^https:\/\/www\.tiktok\.com\/@/);
  });

  it('Instagram URL starts with https://www.instagram.com/', () => {
    expect(buildAccountProfileUrl('instagram', 'user')).toMatch(/^https:\/\/www\.instagram\.com\//);
  });
});
