import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform()', () => {
  // ── TikTok ──────────────────────────────────────────────────────────────
  it('detects tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok subdomain (vm.tiktok.com)', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc123')).toBe('tiktok');
  });

  // ── YouTube Shorts ───────────────────────────────────────────────────────
  it('detects youtube.com /shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com /shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/xyz')).toBe('youtube_shorts');
  });

  it('detects youtu.be short link', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('returns null for youtube.com without /shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  // ── Facebook Reels ───────────────────────────────────────────────────────
  it('detects facebook.com /reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects facebook.com /reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects fb.watch short link', () => {
    expect(detectPlatform('https://fb.watch/abc123')).toBe('facebook_reels');
  });

  it('returns null for facebook.com without /reel/', () => {
    expect(detectPlatform('https://www.facebook.com/watch/?v=123')).toBeNull();
  });

  // ── Unrecognised / invalid ───────────────────────────────────────────────
  it('returns null for an Instagram URL', () => {
    expect(detectPlatform('https://www.instagram.com/p/abc/')).toBeNull();
  });

  it('returns null for a random URL', () => {
    expect(detectPlatform('https://example.com/video/123')).toBeNull();
  });

  it('returns null for a completely invalid string', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a bare hostname with no scheme', () => {
    expect(detectPlatform('tiktok.com/@user')).toBeNull();
  });
});

describe('buildAccountProfileUrl()', () => {
  // ── YouTube ──────────────────────────────────────────────────────────────
  it('prefixes @ for a bare YouTube handle', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('does not double-prefix @ for a YouTube handle that already starts with @', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  // ── TikTok ───────────────────────────────────────────────────────────────
  it('builds a TikTok profile URL from a bare handle', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('strips leading @ before inserting it for TikTok', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  // ── Instagram ────────────────────────────────────────────────────────────
  it('builds an Instagram profile URL from a bare handle', () => {
    expect(buildAccountProfileUrl('instagram', 'nasa')).toBe('https://www.instagram.com/nasa/');
  });

  it('strips leading @ before inserting it for Instagram', () => {
    expect(buildAccountProfileUrl('instagram', '@nasa')).toBe('https://www.instagram.com/nasa/');
  });

  it('handles handles with underscores and dots', () => {
    expect(buildAccountProfileUrl('instagram', 'my.user_name')).toBe('https://www.instagram.com/my.user_name/');
  });
});
