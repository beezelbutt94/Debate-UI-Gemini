import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform()', () => {
  // --- invalid input ---
  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a non-URL string', () => {
    expect(detectPlatform('not a url')).toBeNull();
  });

  it('returns null for a bare domain with no scheme', () => {
    expect(detectPlatform('tiktok.com/video/123')).toBeNull();
  });

  // --- TikTok ---
  it('detects tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects a tiktok subdomain (e.g. vm.tiktok.com)', () => {
    expect(detectPlatform('https://vm.tiktok.com/ZMjQ1234/')).toBe('tiktok');
  });

  // --- YouTube Shorts ---
  it('detects youtube.com /shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com /shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtu.be short link', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('returns null for a youtube.com URL that is NOT /shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('returns null for a youtube.com /channel/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/channel/UCxxx')).toBeNull();
  });

  // --- Facebook Reels ---
  it('detects facebook.com /reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects facebook.com /reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects fb.watch URL', () => {
    expect(detectPlatform('https://fb.watch/abc123/')).toBe('facebook_reels');
  });

  it('returns null for a facebook.com URL that is not a reel', () => {
    expect(detectPlatform('https://www.facebook.com/videos/123456')).toBeNull();
  });

  it('returns null for a facebook.com post URL', () => {
    expect(detectPlatform('https://www.facebook.com/user/posts/123')).toBeNull();
  });

  // --- Unrecognised ---
  it('returns null for instagram.com', () => {
    expect(detectPlatform('https://www.instagram.com/p/abc123/')).toBeNull();
  });

  it('returns null for twitter.com', () => {
    expect(detectPlatform('https://twitter.com/user/status/123')).toBeNull();
  });

  it('returns null for an arbitrary https URL', () => {
    expect(detectPlatform('https://example.com/video/123')).toBeNull();
  });
});

describe('buildAccountProfileUrl()', () => {
  // --- YouTube ---
  it('returns YouTube URL with @ already present', () => {
    expect(buildAccountProfileUrl('youtube', '@mychannel')).toBe('https://www.youtube.com/@mychannel');
  });

  it('adds @ prefix when handle has no @ for YouTube', () => {
    expect(buildAccountProfileUrl('youtube', 'mychannel')).toBe('https://www.youtube.com/@mychannel');
  });

  it('does not double the @ for YouTube', () => {
    const url = buildAccountProfileUrl('youtube', '@creator');
    expect(url).toBe('https://www.youtube.com/@creator');
    expect(url).not.toContain('@@');
  });

  // --- TikTok ---
  it('returns TikTok URL stripping leading @', () => {
    expect(buildAccountProfileUrl('tiktok', '@tiktoker')).toBe('https://www.tiktok.com/@tiktoker');
  });

  it('returns TikTok URL adding @ when absent', () => {
    expect(buildAccountProfileUrl('tiktok', 'tiktoker')).toBe('https://www.tiktok.com/@tiktoker');
  });

  it('does not double @ for TikTok', () => {
    const url = buildAccountProfileUrl('tiktok', '@tiktoker');
    expect(url).not.toContain('@@');
  });

  // --- Instagram ---
  it('returns Instagram URL stripping leading @', () => {
    expect(buildAccountProfileUrl('instagram', '@grammer')).toBe('https://www.instagram.com/grammer/');
  });

  it('returns Instagram URL adding trailing slash when no @ prefix', () => {
    expect(buildAccountProfileUrl('instagram', 'grammer')).toBe('https://www.instagram.com/grammer/');
  });

  it('does not double @ for Instagram', () => {
    const url = buildAccountProfileUrl('instagram', '@grammer');
    expect(url).not.toContain('@');
  });

  it('produces valid URLs for all three platforms', () => {
    for (const platform of ['youtube', 'tiktok', 'instagram'] as const) {
      const url = buildAccountProfileUrl(platform, 'handle');
      expect(() => new URL(url)).not.toThrow();
    }
  });
});
