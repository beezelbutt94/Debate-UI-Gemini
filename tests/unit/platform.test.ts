import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform()', () => {
  // TikTok
  it('detects tiktok.com URLs', () => {
    expect(detectPlatform('https://www.tiktok.com/@creator/video/123')).toBe('tiktok');
  });

  it('detects bare tiktok.com (no www)', () => {
    expect(detectPlatform('https://tiktok.com/@user')).toBe('tiktok');
  });

  it('detects tiktok subdomains', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com /shorts/ URLs', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('detects youtube.com shorts without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtu.be short links as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('returns null for a regular (non-shorts) youtube.com URL', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com /reel/ URLs', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('detects fb.watch short links as facebook_reels', () => {
    expect(detectPlatform('https://fb.watch/abc123')).toBe('facebook_reels');
  });

  it('returns null for a plain facebook.com post URL', () => {
    expect(detectPlatform('https://www.facebook.com/username/posts/123')).toBeNull();
  });

  // Edge cases
  it('returns null for an invalid URL', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for an unrecognized domain', () => {
    expect(detectPlatform('https://www.twitter.com/status/123')).toBeNull();
  });

  it('returns null for an instagram URL (not in supported list)', () => {
    expect(detectPlatform('https://www.instagram.com/p/abc/')).toBeNull();
  });
});

describe('buildAccountProfileUrl()', () => {
  it('builds a youtube URL with leading @', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('adds @ prefix when handle lacks it for youtube', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('builds a tiktok URL and strips leading @', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('builds a tiktok URL without @', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('builds an instagram URL and strips @', () => {
    expect(buildAccountProfileUrl('instagram', '@cristiano')).toBe('https://www.instagram.com/cristiano/');
  });

  it('builds an instagram URL without @', () => {
    expect(buildAccountProfileUrl('instagram', 'cristiano')).toBe('https://www.instagram.com/cristiano/');
  });

  it('youtube double-@ handle is handled correctly', () => {
    // handle already has @, should not add another
    expect(buildAccountProfileUrl('youtube', '@creator')).toBe('https://www.youtube.com/@creator');
  });
});
