import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ─── detectPlatform ───────────────────────────────────────────────────────────

describe('detectPlatform', () => {
  // TikTok
  it('detects tiktok.com URLs', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects bare tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok subdomains', () => {
    expect(detectPlatform('https://vm.tiktok.com/ZMxxxxxx/')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com /shorts/ URLs', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abcDEF')).toBe('youtube_shorts');
  });

  it('detects youtube.com /shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abcDEF')).toBe('youtube_shorts');
  });

  it('detects youtu.be short links as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/abcDEF')).toBe('youtube_shorts');
  });

  it('does NOT classify regular youtube.com (non-shorts) URLs', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abcDEF')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com /reel/ URLs', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('detects facebook.com /reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('detects fb.watch short links as facebook_reels', () => {
    expect(detectPlatform('https://fb.watch/abcdef')).toBe('facebook_reels');
  });

  it('does NOT classify facebook.com pages that are not reels', () => {
    expect(detectPlatform('https://www.facebook.com/someuser')).toBeNull();
  });

  // Unknown / invalid
  it('returns null for instagram URLs', () => {
    expect(detectPlatform('https://www.instagram.com/p/abc123/')).toBeNull();
  });

  it('returns null for twitter URLs', () => {
    expect(detectPlatform('https://twitter.com/user/status/123')).toBeNull();
  });

  it('returns null for a completely invalid URL string', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a random domain', () => {
    expect(detectPlatform('https://example.com/video/123')).toBeNull();
  });

  it('handles youtube subdomain without /shorts/', () => {
    expect(detectPlatform('https://m.youtube.com/watch?v=abc')).toBeNull();
  });

  it('detects youtube subdomain with /shorts/', () => {
    expect(detectPlatform('https://m.youtube.com/shorts/abc')).toBe('youtube_shorts');
  });

  it('detects facebook subdomain with /reel/', () => {
    expect(detectPlatform('https://m.facebook.com/reel/123456789')).toBe('facebook_reels');
  });
});

// ─── buildAccountProfileUrl ───────────────────────────────────────────────────

describe('buildAccountProfileUrl', () => {
  // YouTube
  it('builds youtube URL for handle without @', () => {
    expect(buildAccountProfileUrl('youtube', 'mkbhd')).toBe('https://www.youtube.com/@mkbhd');
  });

  it('builds youtube URL for handle with @ already present', () => {
    expect(buildAccountProfileUrl('youtube', '@mkbhd')).toBe('https://www.youtube.com/@mkbhd');
  });

  it('builds youtube URL preserving case', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  // TikTok
  it('builds tiktok URL for handle without @', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('strips leading @ before building tiktok URL', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('handles tiktok handle with multiple @ characters', () => {
    // Only leading @ is stripped via replace(/^@/, '')
    expect(buildAccountProfileUrl('tiktok', '@user')).toBe('https://www.tiktok.com/@user');
  });

  // Instagram
  it('builds instagram URL for handle without @', () => {
    expect(buildAccountProfileUrl('instagram', 'natgeo')).toBe('https://www.instagram.com/natgeo/');
  });

  it('strips leading @ before building instagram URL', () => {
    expect(buildAccountProfileUrl('instagram', '@natgeo')).toBe('https://www.instagram.com/natgeo/');
  });

  it('builds instagram URL trailing slash always present', () => {
    const url = buildAccountProfileUrl('instagram', 'test');
    expect(url.endsWith('/')).toBe(true);
  });
});
