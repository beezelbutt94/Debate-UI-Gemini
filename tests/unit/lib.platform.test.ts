import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ─── detectPlatform ──────────────────────────────────────────────────────────

describe('detectPlatform()', () => {
  // TikTok
  it('detects standard tiktok.com video URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok subdomain (e.g. m.tiktok.com)', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('returns tiktok for any path on tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/explore')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com/shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abcXYZ123')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abcXYZ123')).toBe('youtube_shorts');
  });

  it('detects subdomain youtube URL with /shorts/', () => {
    expect(detectPlatform('https://m.youtube.com/shorts/abc')).toBe('youtube_shorts');
  });

  it('returns null for youtube.com URL that is NOT a short', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });

  it('detects youtu.be short-form link as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/abcXYZ123')).toBe('youtube_shorts');
  });

  // Facebook Reels
  it('detects facebook.com/reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects facebook.com/reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects m.facebook.com/reel/', () => {
    expect(detectPlatform('https://m.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects fb.watch shortlink as facebook_reels', () => {
    expect(detectPlatform('https://fb.watch/abc123/')).toBe('facebook_reels');
  });

  it('returns null for facebook.com URL that is not a reel', () => {
    expect(detectPlatform('https://www.facebook.com/some/video/123456')).toBeNull();
  });

  // Unknown / invalid
  it('returns null for an unrecognised domain', () => {
    expect(detectPlatform('https://instagram.com/p/abc')).toBeNull();
  });

  it('returns null for a plain string that is not a URL', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for twitter/X URL', () => {
    expect(detectPlatform('https://twitter.com/i/status/123')).toBeNull();
  });

  it('returns null for a URL with only a hostname that looks like youtube but no path', () => {
    expect(detectPlatform('https://youtube.com/')).toBeNull();
  });
});

// ─── buildAccountProfileUrl ──────────────────────────────────────────────────

describe('buildAccountProfileUrl()', () => {
  // YouTube
  it('builds youtube URL with @ prefix when handle has no @', () => {
    expect(buildAccountProfileUrl('youtube', 'mkbhd')).toBe('https://www.youtube.com/@mkbhd');
  });

  it('builds youtube URL preserving @ when handle already has it', () => {
    expect(buildAccountProfileUrl('youtube', '@mkbhd')).toBe('https://www.youtube.com/@mkbhd');
  });

  it('does not double-@ for youtube', () => {
    const url = buildAccountProfileUrl('youtube', '@@mkbhd');
    // @@ starts with @, so it stays as-is
    expect(url).toBe('https://www.youtube.com/@@mkbhd');
  });

  // TikTok
  it('builds tiktok URL with @ stripped then re-added', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('builds tiktok URL stripping leading @ before adding it back', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  // Instagram
  it('builds instagram URL stripping leading @', () => {
    expect(buildAccountProfileUrl('instagram', '@natgeo')).toBe('https://www.instagram.com/natgeo/');
  });

  it('builds instagram URL without @ in handle', () => {
    expect(buildAccountProfileUrl('instagram', 'natgeo')).toBe('https://www.instagram.com/natgeo/');
  });

  it('instagram URL ends with trailing slash', () => {
    const url = buildAccountProfileUrl('instagram', 'test');
    expect(url).toMatch(/\/$/);
  });

  it('youtube URL is a valid URL', () => {
    const url = buildAccountProfileUrl('youtube', 'channelname');
    expect(() => new URL(url)).not.toThrow();
  });

  it('tiktok URL is a valid URL', () => {
    const url = buildAccountProfileUrl('tiktok', 'creator');
    expect(() => new URL(url)).not.toThrow();
  });

  it('instagram URL is a valid URL', () => {
    const url = buildAccountProfileUrl('instagram', 'creator');
    expect(() => new URL(url)).not.toThrow();
  });

  it('all three platform URLs use https', () => {
    expect(buildAccountProfileUrl('youtube', 'x')).toMatch(/^https:\/\//);
    expect(buildAccountProfileUrl('tiktok', 'x')).toMatch(/^https:\/\//);
    expect(buildAccountProfileUrl('instagram', 'x')).toMatch(/^https:\/\//);
  });
});
