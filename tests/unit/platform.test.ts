import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ─── detectPlatform ──────────────────────────────────────────────────────────

describe('detectPlatform()', () => {
  // ── TikTok ────────────────────────────────────────────────────────────────
  it('detects tiktok.com video URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123456')).toBe('tiktok');
  });

  it('detects bare tiktok.com (no www)', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123456')).toBe('tiktok');
  });

  it('detects subdomain of tiktok.com (m.tiktok.com)', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/999')).toBe('tiktok');
  });

  it('detects vm.tiktok.com (share link subdomain)', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc123/')).toBe('tiktok');
  });

  // ── YouTube Shorts ─────────────────────────────────────────────────────────
  it('detects youtube.com /shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('detects youtube.com /shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc')).toBe('youtube_shorts');
  });

  it('detects youtu.be short link', () => {
    expect(detectPlatform('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('returns null for a regular youtube.com watch URL (not /shorts/)', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc')).toBeNull();
  });

  // ── Facebook Reels ─────────────────────────────────────────────────────────
  it('detects facebook.com /reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects facebook.com /reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/789')).toBe('facebook_reels');
  });

  it('detects fb.watch short link', () => {
    expect(detectPlatform('https://fb.watch/abc123/')).toBe('facebook_reels');
  });

  it('returns null for facebook.com non-reel URL', () => {
    expect(detectPlatform('https://www.facebook.com/someuser/posts/123')).toBeNull();
  });

  // ── Unrecognised / invalid ─────────────────────────────────────────────────
  it('returns null for an unknown domain', () => {
    expect(detectPlatform('https://www.instagram.com/p/abc')).toBeNull();
  });

  it('returns null for a totally invalid URL string', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a twitter URL', () => {
    expect(detectPlatform('https://twitter.com/i/status/123')).toBeNull();
  });

  it('returns null for a URL that only contains "tiktok" in its path (wrong domain)', () => {
    expect(detectPlatform('https://www.example.com/tiktok/video')).toBeNull();
  });

  it('returns null for a URL that contains "/shorts/" but is not youtube.com', () => {
    expect(detectPlatform('https://www.vimeo.com/shorts/abc')).toBeNull();
  });

  it('handles extra-long, deeply nested tiktok URL', () => {
    expect(detectPlatform('https://tiktok.com/@creator/video/9999999999999?referrer=share&utm_source=tiktok')).toBe('tiktok');
  });
});

// ─── buildAccountProfileUrl ───────────────────────────────────────────────────

describe('buildAccountProfileUrl()', () => {
  // ── youtube ───────────────────────────────────────────────────────────────
  it('prefixes @ for a bare youtube handle', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('does not double-prefix @ for a youtube handle that already starts with @', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  // ── tiktok ────────────────────────────────────────────────────────────────
  it('strips leading @ before prepending it for tiktok', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('adds @ for a bare tiktok handle', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  // ── instagram ─────────────────────────────────────────────────────────────
  it('strips leading @ for instagram handle', () => {
    expect(buildAccountProfileUrl('instagram', '@cristiano')).toBe('https://www.instagram.com/cristiano/');
  });

  it('uses bare handle for instagram URL', () => {
    expect(buildAccountProfileUrl('instagram', 'cristiano')).toBe('https://www.instagram.com/cristiano/');
  });

  it('handles mixed-case youtube handle', () => {
    expect(buildAccountProfileUrl('youtube', 'PewDiePie')).toBe('https://www.youtube.com/@PewDiePie');
  });

  it('handles handle with numbers', () => {
    expect(buildAccountProfileUrl('tiktok', 'user123')).toBe('https://www.tiktok.com/@user123');
  });

  it('instagram trailing slash is always present', () => {
    const url = buildAccountProfileUrl('instagram', 'nasa');
    expect(url.endsWith('/')).toBe(true);
  });
});
