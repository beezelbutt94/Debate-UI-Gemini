import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ─── detectPlatform ───────────────────────────────────────────────────────────

describe('detectPlatform()', () => {
  // ── TikTok ──────────────────────────────────────────────────────────────────
  it('detects tiktok.com with www', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects vm.tiktok.com subdomain', () => {
    expect(detectPlatform('https://vm.tiktok.com/ZMxxxxxx/')).toBe('tiktok');
  });

  it('detects m.tiktok.com subdomain', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  // ── YouTube Shorts ───────────────────────────────────────────────────────────
  it('detects youtube.com/shorts/ with www', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtu.be as youtube_shorts', () => {
    // youtu.be is treated as youtube_shorts per current implementation
    expect(detectPlatform('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('returns null for youtube.com/watch (not a short)', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });

  it('returns null for youtube.com channel page', () => {
    expect(detectPlatform('https://www.youtube.com/@creator')).toBeNull();
  });

  // ── Facebook Reels ───────────────────────────────────────────────────────────
  it('detects facebook.com/reel/ with www', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('detects facebook.com/reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('detects fb.watch links', () => {
    expect(detectPlatform('https://fb.watch/abc123xyz/')).toBe('facebook_reels');
  });

  it('detects mobile m.facebook.com reel', () => {
    expect(detectPlatform('https://m.facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('returns null for facebook.com post (not a reel)', () => {
    expect(detectPlatform('https://www.facebook.com/photo/?fbid=123')).toBeNull();
  });

  it('returns null for facebook.com/videos (not a reel path)', () => {
    expect(detectPlatform('https://www.facebook.com/videos/123')).toBeNull();
  });

  // ── Unsupported / invalid ────────────────────────────────────────────────────
  it('returns null for instagram.com', () => {
    expect(detectPlatform('https://www.instagram.com/p/abc123/')).toBeNull();
  });

  it('returns null for twitter.com', () => {
    expect(detectPlatform('https://twitter.com/i/status/123')).toBeNull();
  });

  it('returns null for an unparsable string', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a URL with no recognisable host', () => {
    expect(detectPlatform('https://example.com/video/123')).toBeNull();
  });
});

// ─── buildAccountProfileUrl ───────────────────────────────────────────────────

describe('buildAccountProfileUrl()', () => {
  // ── YouTube ──────────────────────────────────────────────────────────────────
  it('builds youtube URL when handle already has @', () => {
    expect(buildAccountProfileUrl('youtube', '@creator')).toBe('https://www.youtube.com/@creator');
  });

  it('builds youtube URL by prepending @ when handle lacks it', () => {
    expect(buildAccountProfileUrl('youtube', 'creator')).toBe('https://www.youtube.com/@creator');
  });

  // ── TikTok ───────────────────────────────────────────────────────────────────
  it('builds tiktok URL when handle already has @', () => {
    expect(buildAccountProfileUrl('tiktok', '@handle')).toBe('https://www.tiktok.com/@handle');
  });

  it('builds tiktok URL by prepending @ when handle lacks it', () => {
    expect(buildAccountProfileUrl('tiktok', 'handle')).toBe('https://www.tiktok.com/@handle');
  });

  it('does not double-@ on tiktok if handle starts with @', () => {
    // handle.replace(/^@/, '') strips the existing @, then we prepend one
    const result = buildAccountProfileUrl('tiktok', '@user');
    expect(result).toBe('https://www.tiktok.com/@user');
    expect(result).not.toContain('@@');
  });

  // ── Instagram ────────────────────────────────────────────────────────────────
  it('builds instagram URL when handle already has @', () => {
    expect(buildAccountProfileUrl('instagram', '@user')).toBe('https://www.instagram.com/user/');
  });

  it('builds instagram URL when handle lacks @', () => {
    expect(buildAccountProfileUrl('instagram', 'user')).toBe('https://www.instagram.com/user/');
  });

  it('includes trailing slash on instagram URLs', () => {
    expect(buildAccountProfileUrl('instagram', 'creator')).toMatch(/\/$/);
  });

  it('does not include @ in instagram URL path', () => {
    const result = buildAccountProfileUrl('instagram', '@nohash');
    expect(result).not.toContain('@');
  });

  // ── General structural checks ─────────────────────────────────────────────────
  it('always returns a URL starting with https://', () => {
    for (const platform of ['youtube', 'tiktok', 'instagram'] as const) {
      expect(buildAccountProfileUrl(platform, 'testuser')).toMatch(/^https:\/\//);
    }
  });
});
