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

  it('detects tiktok subdomain (vm.tiktok.com)', () => {
    expect(detectPlatform('https://vm.tiktok.com/AbCdEf/')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com/shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('returns null for youtube.com without /shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('detects youtu.be as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  // Facebook Reels
  it('detects facebook.com/reel/', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('detects facebook.com/reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('detects fb.watch', () => {
    expect(detectPlatform('https://fb.watch/AbCdEfGhIj/')).toBe('facebook_reels');
  });

  it('returns null for facebook.com without /reel/', () => {
    expect(detectPlatform('https://www.facebook.com/user/videos/123')).toBeNull();
  });

  // Invalid / unrecognised
  it('returns null for an invalid URL string', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for an unrecognised domain', () => {
    expect(detectPlatform('https://instagram.com/reel/abc123')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for twitter/x.com', () => {
    expect(detectPlatform('https://x.com/user/status/123')).toBeNull();
  });

  it('detects m.tiktok.com as tiktok', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('returns null for a URL with tiktok in the path but wrong host', () => {
    expect(detectPlatform('https://example.com/tiktok/video/123')).toBeNull();
  });
});

describe('buildAccountProfileUrl()', () => {
  // YouTube
  it('builds YouTube URL for handle without @', () => {
    expect(buildAccountProfileUrl('youtube', 'mkbhd')).toBe('https://www.youtube.com/@mkbhd');
  });

  it('builds YouTube URL for handle already with @', () => {
    expect(buildAccountProfileUrl('youtube', '@mkbhd')).toBe('https://www.youtube.com/@mkbhd');
  });

  // TikTok
  it('builds TikTok URL for handle without @', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('builds TikTok URL for handle already with @', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  // Instagram
  it('builds Instagram URL for handle without @', () => {
    expect(buildAccountProfileUrl('instagram', 'nasa')).toBe('https://www.instagram.com/nasa/');
  });

  it('builds Instagram URL for handle already with @', () => {
    expect(buildAccountProfileUrl('instagram', '@nasa')).toBe('https://www.instagram.com/nasa/');
  });

  it('YouTube URL always uses @-prefix format', () => {
    const url = buildAccountProfileUrl('youtube', 'nocopyright');
    expect(url).toBe('https://www.youtube.com/@nocopyright');
  });

  it('TikTok URL strips leading @ before re-adding', () => {
    const url = buildAccountProfileUrl('tiktok', '@@double');
    // replace(/^@/, '') removes ONE leading @
    expect(url).toBe('https://www.tiktok.com/@@double');
  });
});
