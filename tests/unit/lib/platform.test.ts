import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform()', () => {
  // ── TikTok ──────────────────────────────────────────────────────────────
  it('detects www.tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/7123456789')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/7123456789')).toBe('tiktok');
  });

  it('detects m.tiktok.com (subdomain)', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/7123456789')).toBe('tiktok');
  });

  it('detects tiktok with arbitrary subdomain', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc123/')).toBe('tiktok');
  });

  // ── YouTube Shorts ───────────────────────────────────────────────────────
  it('detects www.youtube.com/shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/dEf456')).toBe('youtube_shorts');
  });

  it('detects youtu.be short link', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('does NOT detect regular youtube.com/watch as shorts', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('does NOT detect youtube.com channel page as shorts', () => {
    expect(detectPlatform('https://www.youtube.com/@creator')).toBeNull();
  });

  // ── Facebook Reels ───────────────────────────────────────────────────────
  it('detects www.facebook.com/reel/', () => {
    expect(detectPlatform('https://www.facebook.com/reel/1234567890')).toBe('facebook_reels');
  });

  it('detects facebook.com/reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/1234567890')).toBe('facebook_reels');
  });

  it('detects fb.watch short link', () => {
    expect(detectPlatform('https://fb.watch/abc123/')).toBe('facebook_reels');
  });

  it('does NOT detect facebook.com/watch (not /reel/) as reels', () => {
    expect(detectPlatform('https://www.facebook.com/watch?v=123')).toBeNull();
  });

  // ── Unrecognised / invalid inputs ────────────────────────────────────────
  it('returns null for Instagram reels (not a supported platform)', () => {
    expect(detectPlatform('https://www.instagram.com/reel/abc123')).toBeNull();
  });

  it('returns null for a plain Google URL', () => {
    expect(detectPlatform('https://www.google.com')).toBeNull();
  });

  it('returns null for an invalid/non-URL string', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a URL with unknown hostname', () => {
    expect(detectPlatform('https://www.example.com/video/123')).toBeNull();
  });

  it('returns null for twitter/X video URL', () => {
    expect(detectPlatform('https://twitter.com/i/status/123')).toBeNull();
  });
});

describe('buildAccountProfileUrl()', () => {
  // ── YouTube ──────────────────────────────────────────────────────────────
  it('prefixes @ for a YouTube handle that lacks it', () => {
    expect(buildAccountProfileUrl('youtube', 'creator')).toBe('https://www.youtube.com/@creator');
  });

  it('keeps existing @ for a YouTube handle', () => {
    expect(buildAccountProfileUrl('youtube', '@creator')).toBe('https://www.youtube.com/@creator');
  });

  it('handles mixed-case YouTube handle', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  // ── TikTok ───────────────────────────────────────────────────────────────
  it('strips leading @ before prepending for TikTok', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe(
      'https://www.tiktok.com/@charlidamelio'
    );
  });

  it('adds @ prefix for a TikTok handle that lacks it', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe(
      'https://www.tiktok.com/@charlidamelio'
    );
  });

  // ── Instagram ────────────────────────────────────────────────────────────
  it('strips leading @ for Instagram handle', () => {
    expect(buildAccountProfileUrl('instagram', '@cristiano')).toBe(
      'https://www.instagram.com/cristiano/'
    );
  });

  it('uses bare handle for Instagram without @ prefix', () => {
    expect(buildAccountProfileUrl('instagram', 'cristiano')).toBe(
      'https://www.instagram.com/cristiano/'
    );
  });

  it('handles mixed-case Instagram handle', () => {
    expect(buildAccountProfileUrl('instagram', 'NationalGeographic')).toBe(
      'https://www.instagram.com/NationalGeographic/'
    );
  });
});
