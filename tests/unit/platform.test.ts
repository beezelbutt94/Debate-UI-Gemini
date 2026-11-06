import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ─── detectPlatform ───────────────────────────────────────────────────────────

describe('detectPlatform()', () => {
  // ── TikTok ──────────────────────────────────────────────────────────────────
  it('detects tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/456')).toBe('tiktok');
  });

  it('detects tiktok subdomain (vm.tiktok.com)', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc123')).toBe('tiktok');
  });

  // ── YouTube Shorts ───────────────────────────────────────────────────────────
  it('detects youtube.com /shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com /shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/xyz')).toBe('youtube_shorts');
  });

  it('detects youtu.be short link', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('does NOT detect youtube.com without /shorts/ path', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc')).toBeNull();
  });

  it('does NOT detect youtube.com /channel/ path', () => {
    expect(detectPlatform('https://www.youtube.com/channel/abc')).toBeNull();
  });

  // ── Facebook Reels ───────────────────────────────────────────────────────────
  it('detects facebook.com /reel/', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects facebook.com /reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/789')).toBe('facebook_reels');
  });

  it('detects fb.watch shortlink', () => {
    expect(detectPlatform('https://fb.watch/sometoken/')).toBe('facebook_reels');
  });

  it('does NOT detect facebook.com without /reel/ path', () => {
    expect(detectPlatform('https://www.facebook.com/someuser')).toBeNull();
  });

  // ── Unsupported / invalid ────────────────────────────────────────────────────
  it('returns null for instagram URL', () => {
    expect(detectPlatform('https://www.instagram.com/p/abc123/')).toBeNull();
  });

  it('returns null for twitter/X', () => {
    expect(detectPlatform('https://x.com/user/status/123')).toBeNull();
  });

  it('returns null for a totally different domain', () => {
    expect(detectPlatform('https://example.com/video')).toBeNull();
  });

  it('returns null for a non-URL string', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a bare hostname with no scheme', () => {
    expect(detectPlatform('tiktok.com/@user')).toBeNull();
  });
});

// ─── buildAccountProfileUrl ───────────────────────────────────────────────────

describe('buildAccountProfileUrl()', () => {
  // ── youtube ──────────────────────────────────────────────────────────────────
  it('prefixes youtube handle with @ when missing', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('keeps youtube handle that already has @', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('youtube: handles handle with numbers and underscores', () => {
    expect(buildAccountProfileUrl('youtube', 'user_123')).toBe('https://www.youtube.com/@user_123');
  });

  // ── tiktok ───────────────────────────────────────────────────────────────────
  it('strips leading @ from tiktok handle', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('adds @ prefix when tiktok handle has no @', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('tiktok: does not double the @ if already present', () => {
    const url = buildAccountProfileUrl('tiktok', '@user');
    expect(url).toBe('https://www.tiktok.com/@user');
    expect(url).not.toContain('@@');
  });

  // ── instagram ─────────────────────────────────────────────────────────────────
  it('strips leading @ from instagram handle', () => {
    expect(buildAccountProfileUrl('instagram', '@cristiano')).toBe('https://www.instagram.com/cristiano/');
  });

  it('adds no @ for instagram when handle has none', () => {
    expect(buildAccountProfileUrl('instagram', 'cristiano')).toBe('https://www.instagram.com/cristiano/');
  });

  it('instagram URL always ends with trailing slash', () => {
    const url = buildAccountProfileUrl('instagram', 'user');
    expect(url.endsWith('/')).toBe(true);
  });
});
