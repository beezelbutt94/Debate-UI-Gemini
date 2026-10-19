import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform', () => {
  // ── TikTok ──────────────────────────────────────────────────────────
  it('detects tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/12345')).toBe('tiktok');
  });

  it('detects tiktok without www', () => {
    expect(detectPlatform('https://tiktok.com/@creator')).toBe('tiktok');
  });

  it('detects a tiktok subdomain (vm.tiktok.com)', () => {
    expect(detectPlatform('https://vm.tiktok.com/ZMF12345/')).toBe('tiktok');
  });

  // ── YouTube Shorts ───────────────────────────────────────────────────
  it('detects youtube.com/shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/xyz')).toBe('youtube_shorts');
  });

  it('does NOT detect a regular youtube.com watch URL as shorts', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('detects youtu.be as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  // ── Facebook Reels ───────────────────────────────────────────────────
  it('detects facebook.com/reel/', () => {
    expect(detectPlatform('https://www.facebook.com/reel/1234567')).toBe('facebook_reels');
  });

  it('detects facebook.com/reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/9876543')).toBe('facebook_reels');
  });

  it('detects fb.watch URLs as facebook_reels', () => {
    expect(detectPlatform('https://fb.watch/abc123/')).toBe('facebook_reels');
  });

  it('does NOT detect a generic facebook.com page as reels', () => {
    expect(detectPlatform('https://www.facebook.com/someuser')).toBeNull();
  });

  // ── Unknown / invalid URLs ───────────────────────────────────────────
  it('returns null for an unknown domain', () => {
    expect(detectPlatform('https://instagram.com/reels/abc')).toBeNull();
  });

  it('returns null for a plain string that is not a URL', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a relative path', () => {
    expect(detectPlatform('/reel/abc123')).toBeNull();
  });

  it('returns null for a twitter URL', () => {
    expect(detectPlatform('https://twitter.com/i/status/123')).toBeNull();
  });

  it('handles m.facebook.com/reel/ as facebook_reels', () => {
    expect(detectPlatform('https://m.facebook.com/reel/111222333')).toBe('facebook_reels');
  });
});

describe('buildAccountProfileUrl', () => {
  // ── YouTube ──────────────────────────────────────────────────────────
  it('builds a youtube URL with a bare handle (no @)', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe(
      'https://www.youtube.com/@MrBeast'
    );
  });

  it('builds a youtube URL when the handle already has @', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe(
      'https://www.youtube.com/@MrBeast'
    );
  });

  // ── TikTok ───────────────────────────────────────────────────────────
  it('builds a tiktok URL stripping existing @', () => {
    expect(buildAccountProfileUrl('tiktok', '@charli')).toBe(
      'https://www.tiktok.com/@charli'
    );
  });

  it('builds a tiktok URL adding @ to bare handle', () => {
    expect(buildAccountProfileUrl('tiktok', 'charli')).toBe(
      'https://www.tiktok.com/@charli'
    );
  });

  it('does not double-prepend @ on tiktok', () => {
    expect(buildAccountProfileUrl('tiktok', '@user')).toBe(
      'https://www.tiktok.com/@user'
    );
  });

  // ── Instagram ────────────────────────────────────────────────────────
  it('builds an instagram URL stripping existing @', () => {
    expect(buildAccountProfileUrl('instagram', '@nasa')).toBe(
      'https://www.instagram.com/nasa/'
    );
  });

  it('builds an instagram URL from a bare handle', () => {
    expect(buildAccountProfileUrl('instagram', 'nasa')).toBe(
      'https://www.instagram.com/nasa/'
    );
  });

  it('trailing slash present for instagram', () => {
    const url = buildAccountProfileUrl('instagram', 'test');
    expect(url.endsWith('/')).toBe(true);
  });

  it('no double @ for tiktok handle with @', () => {
    const url = buildAccountProfileUrl('tiktok', '@user');
    expect(url).not.toContain('@@');
  });
});
