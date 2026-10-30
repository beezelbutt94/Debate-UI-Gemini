import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ── detectPlatform ─────────────────────────────────────────────────────────

describe('detectPlatform()', () => {
  // TikTok
  it('detects tiktok.com URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/1234567890')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok subdomain (m.tiktok.com)', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects vt.tiktok.com (another subdomain)', () => {
    expect(detectPlatform('https://vt.tiktok.com/abc123/')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com/shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('does NOT classify regular youtube.com video as youtube_shorts', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('detects youtu.be short link as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  // Facebook Reels
  it('detects facebook.com/reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/1234567890')).toBe('facebook_reels');
  });

  it('detects facebook.com/reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/1234567890')).toBe('facebook_reels');
  });

  it('detects fb.watch short link as facebook_reels', () => {
    expect(detectPlatform('https://fb.watch/abc123/')).toBe('facebook_reels');
  });

  it('detects subdomain facebook reel URL', () => {
    expect(detectPlatform('https://m.facebook.com/reel/1234567890')).toBe('facebook_reels');
  });

  it('does NOT classify facebook.com video (non-reel) as facebook_reels', () => {
    expect(detectPlatform('https://www.facebook.com/watch/?v=123')).toBeNull();
  });

  // Null cases
  it('returns null for instagram URL', () => {
    expect(detectPlatform('https://www.instagram.com/p/abc123')).toBeNull();
  });

  it('returns null for twitter URL', () => {
    expect(detectPlatform('https://twitter.com/user/status/123')).toBeNull();
  });

  it('returns null for an invalid URL string', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a random domain', () => {
    expect(detectPlatform('https://example.com/video/123')).toBeNull();
  });

  it('is case-sensitive in the path (/Shorts/ does not match)', () => {
    // /Shorts/ (capital S) – should NOT match since the condition checks /shorts/
    expect(detectPlatform('https://www.youtube.com/Shorts/abc123')).toBeNull();
  });
});

// ── buildAccountProfileUrl ─────────────────────────────────────────────────

describe('buildAccountProfileUrl()', () => {
  // YouTube
  it('builds youtube URL with @ prefix handle', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('builds youtube URL without @ prefix (adds it)', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('does not double @ on youtube', () => {
    expect(buildAccountProfileUrl('youtube', '@creator')).toBe('https://www.youtube.com/@creator');
  });

  // TikTok
  it('builds tiktok URL with @ prefix', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('builds tiktok URL without @ prefix (adds it)', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('does not double @ on tiktok', () => {
    expect(buildAccountProfileUrl('tiktok', '@user')).toBe('https://www.tiktok.com/@user');
  });

  // Instagram
  it('builds instagram URL without @ prefix', () => {
    expect(buildAccountProfileUrl('instagram', 'natgeo')).toBe('https://www.instagram.com/natgeo/');
  });

  it('strips leading @ from instagram handle', () => {
    expect(buildAccountProfileUrl('instagram', '@natgeo')).toBe('https://www.instagram.com/natgeo/');
  });

  it('instagram URL always ends with trailing slash', () => {
    const url = buildAccountProfileUrl('instagram', 'user');
    expect(url.endsWith('/')).toBe(true);
  });
});
