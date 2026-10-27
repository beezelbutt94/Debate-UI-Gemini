import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform', () => {
  // --- TikTok ---
  it('detects tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/456')).toBe('tiktok');
  });

  it('detects tiktok subdomain', () => {
    expect(detectPlatform('https://vm.tiktok.com/ZMr123/')).toBe('tiktok');
  });

  it('detects tiktok with query params', () => {
    expect(detectPlatform('https://www.tiktok.com/@creator/video/789?lang=en')).toBe('tiktok');
  });

  // --- YouTube Shorts ---
  it('detects youtube shorts via /shorts/ path', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/xyz')).toBe('youtube_shorts');
  });

  it('detects youtu.be short link', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('returns null for youtube.com regular watch URL (not shorts)', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc')).toBeNull();
  });

  it('returns null for youtube.com channel URL', () => {
    expect(detectPlatform('https://www.youtube.com/channel/UCxxx')).toBeNull();
  });

  // --- Facebook Reels ---
  it('detects facebook.com/reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects facebook.com/reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/789')).toBe('facebook_reels');
  });

  it('detects fb.watch short link', () => {
    expect(detectPlatform('https://fb.watch/abc123/')).toBe('facebook_reels');
  });

  it('returns null for facebook.com non-reel URL', () => {
    expect(detectPlatform('https://www.facebook.com/watch/?v=123')).toBeNull();
  });

  it('returns null for facebook.com post URL', () => {
    expect(detectPlatform('https://www.facebook.com/someone/posts/123')).toBeNull();
  });

  // --- Null cases ---
  it('returns null for an invalid URL string', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for instagram URL', () => {
    expect(detectPlatform('https://www.instagram.com/p/abc/')).toBeNull();
  });

  it('returns null for twitter URL', () => {
    expect(detectPlatform('https://twitter.com/i/status/123')).toBeNull();
  });

  it('returns null for random URL', () => {
    expect(detectPlatform('https://example.com/video/123')).toBeNull();
  });

  it('returns null for bare hostname', () => {
    expect(detectPlatform('youtube.com/shorts/abc')).toBeNull();
  });
});

describe('buildAccountProfileUrl', () => {
  // --- YouTube ---
  it('builds youtube URL from handle with @', () => {
    expect(buildAccountProfileUrl('youtube', '@mychannel')).toBe('https://www.youtube.com/@mychannel');
  });

  it('builds youtube URL from handle without @', () => {
    expect(buildAccountProfileUrl('youtube', 'mychannel')).toBe('https://www.youtube.com/@mychannel');
  });

  it('builds youtube URL preserving existing @', () => {
    expect(buildAccountProfileUrl('youtube', '@creator')).toBe('https://www.youtube.com/@creator');
  });

  // --- TikTok ---
  it('builds tiktok URL from handle without @', () => {
    expect(buildAccountProfileUrl('tiktok', 'creator')).toBe('https://www.tiktok.com/@creator');
  });

  it('builds tiktok URL from handle with @, strips it first', () => {
    expect(buildAccountProfileUrl('tiktok', '@creator')).toBe('https://www.tiktok.com/@creator');
  });

  it('builds tiktok URL with double @ (edge)', () => {
    // replace strips only leading @
    expect(buildAccountProfileUrl('tiktok', '@@creator')).toBe('https://www.tiktok.com/@@creator');
  });

  // --- Instagram ---
  it('builds instagram URL from handle without @', () => {
    expect(buildAccountProfileUrl('instagram', 'photographer')).toBe('https://www.instagram.com/photographer/');
  });

  it('builds instagram URL from handle with @, strips it', () => {
    expect(buildAccountProfileUrl('instagram', '@photographer')).toBe('https://www.instagram.com/photographer/');
  });

  it('instagram URL ends with trailing slash', () => {
    const url = buildAccountProfileUrl('instagram', 'user');
    expect(url.endsWith('/')).toBe(true);
  });

  it('youtube URL does not end with trailing slash', () => {
    const url = buildAccountProfileUrl('youtube', 'mychannel');
    expect(url.endsWith('/')).toBe(false);
  });

  it('tiktok URL does not end with trailing slash', () => {
    const url = buildAccountProfileUrl('tiktok', 'creator');
    expect(url.endsWith('/')).toBe(false);
  });
});
