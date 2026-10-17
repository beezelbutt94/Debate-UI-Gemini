import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform()', () => {
  // --- TikTok ---
  it('detects tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects subdomain of tiktok.com (e.g. vm.tiktok.com)', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc123')).toBe('tiktok');
  });

  it('detects tiktok.com profile URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@someuser')).toBe('tiktok');
  });

  // --- YouTube Shorts ---
  it('detects youtube.com/shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('does NOT detect regular youtube.com watch URLs as shorts', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('detects youtu.be short link as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('detects youtu.be with params', () => {
    expect(detectPlatform('https://youtu.be/abc123?si=xyz')).toBe('youtube_shorts');
  });

  // --- Facebook Reels ---
  it('detects facebook.com/reel/', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('detects facebook.com/reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('detects fb.watch links as facebook_reels', () => {
    expect(detectPlatform('https://fb.watch/shortlink')).toBe('facebook_reels');
  });

  it('does NOT detect regular facebook.com posts as reels', () => {
    expect(detectPlatform('https://www.facebook.com/photo?id=123')).toBeNull();
  });

  it('detects subdomain facebook.com reel', () => {
    expect(detectPlatform('https://m.facebook.com/reel/123')).toBe('facebook_reels');
  });

  // --- Null cases ---
  it('returns null for an invalid URL string', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for instagram.com', () => {
    expect(detectPlatform('https://www.instagram.com/p/abc123/')).toBeNull();
  });

  it('returns null for twitter.com', () => {
    expect(detectPlatform('https://twitter.com/user/status/123')).toBeNull();
  });

  it('returns null for a random website', () => {
    expect(detectPlatform('https://example.com/video/123')).toBeNull();
  });

  it('returns null for a URL with no protocol', () => {
    expect(detectPlatform('tiktok.com/@user')).toBeNull();
  });

  it('returns null for a YouTube channel URL (not /shorts/)', () => {
    expect(detectPlatform('https://www.youtube.com/@channelname')).toBeNull();
  });

  it('does NOT false-positive on a URL that contains "tiktok" as path segment on another domain', () => {
    expect(detectPlatform('https://example.com/tiktok/video/123')).toBeNull();
  });
});

describe('buildAccountProfileUrl()', () => {
  // --- YouTube ---
  it('builds YouTube URL for handle without @', () => {
    expect(buildAccountProfileUrl('youtube', 'mychannel')).toBe('https://www.youtube.com/@mychannel');
  });

  it('builds YouTube URL for handle with @ already', () => {
    expect(buildAccountProfileUrl('youtube', '@mychannel')).toBe('https://www.youtube.com/@mychannel');
  });

  it('builds YouTube URL for handle with uppercase letters', () => {
    expect(buildAccountProfileUrl('youtube', 'MyChannel')).toBe('https://www.youtube.com/@MyChannel');
  });

  // --- TikTok ---
  it('builds TikTok URL for handle without @', () => {
    expect(buildAccountProfileUrl('tiktok', 'creator')).toBe('https://www.tiktok.com/@creator');
  });

  it('builds TikTok URL for handle with @ stripped', () => {
    expect(buildAccountProfileUrl('tiktok', '@creator')).toBe('https://www.tiktok.com/@creator');
  });

  it('does not double-up @ for TikTok', () => {
    const url = buildAccountProfileUrl('tiktok', '@user');
    expect(url).toBe('https://www.tiktok.com/@user');
    expect(url).not.toContain('@@');
  });

  // --- Instagram ---
  it('builds Instagram URL for handle without @', () => {
    expect(buildAccountProfileUrl('instagram', 'myprofile')).toBe('https://www.instagram.com/myprofile/');
  });

  it('builds Instagram URL for handle with @ stripped', () => {
    expect(buildAccountProfileUrl('instagram', '@myprofile')).toBe('https://www.instagram.com/myprofile/');
  });

  it('Instagram URL ends with trailing slash', () => {
    const url = buildAccountProfileUrl('instagram', 'someone');
    expect(url.endsWith('/')).toBe(true);
  });

  it('all returned URLs start with https://', () => {
    expect(buildAccountProfileUrl('youtube', 'c')).toMatch(/^https:\/\//);
    expect(buildAccountProfileUrl('tiktok', 'c')).toMatch(/^https:\/\//);
    expect(buildAccountProfileUrl('instagram', 'c')).toMatch(/^https:\/\//);
  });
});
