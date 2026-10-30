import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform()', () => {
  // TikTok
  it('detects tiktok.com URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/456')).toBe('tiktok');
  });

  it('detects tiktok subdomain', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/789')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com /shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com /shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtu.be short link', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('rejects youtube.com watch URL (not shorts)', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('rejects youtube.com channel URL', () => {
    expect(detectPlatform('https://www.youtube.com/@channelname')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com /reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects facebook.com /reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects fb.watch URL', () => {
    expect(detectPlatform('https://fb.watch/abc123/')).toBe('facebook_reels');
  });

  it('detects facebook subdomain with /reel/', () => {
    expect(detectPlatform('https://m.facebook.com/reel/789')).toBe('facebook_reels');
  });

  it('rejects facebook.com non-reel URL', () => {
    expect(detectPlatform('https://www.facebook.com/watch/?v=123')).toBeNull();
  });

  // Invalid inputs
  it('returns null for a completely unrecognized domain', () => {
    expect(detectPlatform('https://instagram.com/reel/abc')).toBeNull();
  });

  it('returns null for a malformed URL', () => {
    expect(detectPlatform('not a url')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a bare domain without protocol', () => {
    expect(detectPlatform('tiktok.com/@user/video/123')).toBeNull();
  });

  it('returns null for arbitrary random string', () => {
    expect(detectPlatform('hello world')).toBeNull();
  });

  it('handles twitter.com as null', () => {
    expect(detectPlatform('https://twitter.com/status/123')).toBeNull();
  });

  it('handles vimeo.com as null', () => {
    expect(detectPlatform('https://vimeo.com/123456')).toBeNull();
  });
});

describe('buildAccountProfileUrl()', () => {
  // YouTube
  it('builds YouTube URL for handle with @', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('builds YouTube URL for handle without @', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('builds YouTube URL for handle with @ already', () => {
    expect(buildAccountProfileUrl('youtube', '@some.creator')).toBe('https://www.youtube.com/@some.creator');
  });

  // TikTok
  it('builds TikTok URL for handle with @', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('builds TikTok URL for handle without @', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('builds TikTok URL stripping leading @', () => {
    expect(buildAccountProfileUrl('tiktok', '@user123')).toBe('https://www.tiktok.com/@user123');
  });

  // Instagram
  it('builds Instagram URL for handle without @', () => {
    expect(buildAccountProfileUrl('instagram', 'natgeo')).toBe('https://www.instagram.com/natgeo/');
  });

  it('builds Instagram URL stripping leading @', () => {
    expect(buildAccountProfileUrl('instagram', '@natgeo')).toBe('https://www.instagram.com/natgeo/');
  });

  it('builds Instagram URL for handle with multiple chars', () => {
    expect(buildAccountProfileUrl('instagram', 'creator_handle_2024')).toBe('https://www.instagram.com/creator_handle_2024/');
  });

  // Edge cases
  it('YouTube handle with dots and underscores', () => {
    const url = buildAccountProfileUrl('youtube', 'my.channel_name');
    expect(url).toBe('https://www.youtube.com/@my.channel_name');
  });

  it('TikTok handle already stripped', () => {
    expect(buildAccountProfileUrl('tiktok', 'noatsign')).toBe('https://www.tiktok.com/@noatsign');
  });
});
