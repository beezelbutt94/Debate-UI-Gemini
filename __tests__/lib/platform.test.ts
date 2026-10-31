import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform', () => {
  // ── TikTok ──────────────────────────────────────────────────────────────
  it('detects bare tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok subdomain (e.g. m.tiktok.com)', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects vm.tiktok.com short link', () => {
    expect(detectPlatform('https://vm.tiktok.com/ZMeAbcDef/')).toBe('tiktok');
  });

  // ── YouTube Shorts ───────────────────────────────────────────────────────
  it('detects youtube.com /shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com without www for /shorts/', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtu.be short link as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('does NOT detect regular youtube.com watch URL as shorts', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('does NOT detect youtube.com channel page as shorts', () => {
    expect(detectPlatform('https://www.youtube.com/@channelname')).toBeNull();
  });

  // ── Facebook Reels ───────────────────────────────────────────────────────
  it('detects facebook.com /reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('detects facebook.com /reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('detects fb.watch short link', () => {
    expect(detectPlatform('https://fb.watch/abcXYZ/')).toBe('facebook_reels');
  });

  it('does NOT detect regular facebook.com post as reels', () => {
    expect(detectPlatform('https://www.facebook.com/user/posts/123')).toBeNull();
  });

  it('does NOT detect facebook.com video (not a reel) as reels', () => {
    expect(detectPlatform('https://www.facebook.com/watch/?v=123')).toBeNull();
  });

  // ── Unknown / invalid ────────────────────────────────────────────────────
  it('returns null for an unknown domain', () => {
    expect(detectPlatform('https://instagram.com/p/abc')).toBeNull();
  });

  it('returns null for a non-URL string', () => {
    expect(detectPlatform('not a url')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a bare domain without protocol', () => {
    expect(detectPlatform('tiktok.com/@user/video/123')).toBeNull();
  });

  it('returns null for twitter URL', () => {
    expect(detectPlatform('https://twitter.com/user/status/123')).toBeNull();
  });
});

describe('buildAccountProfileUrl', () => {
  // ── YouTube ──────────────────────────────────────────────────────────────
  it('builds YouTube URL with bare handle (no @)', () => {
    expect(buildAccountProfileUrl('youtube', 'channelname')).toBe(
      'https://www.youtube.com/@channelname'
    );
  });

  it('builds YouTube URL with @ prefixed handle', () => {
    expect(buildAccountProfileUrl('youtube', '@channelname')).toBe(
      'https://www.youtube.com/@channelname'
    );
  });

  it('does not double-prefix @ for YouTube', () => {
    const url = buildAccountProfileUrl('youtube', '@user');
    expect(url).toBe('https://www.youtube.com/@user');
    expect(url).not.toContain('@@');
  });

  // ── TikTok ───────────────────────────────────────────────────────────────
  it('builds TikTok URL stripping leading @ from handle', () => {
    expect(buildAccountProfileUrl('tiktok', '@creator')).toBe(
      'https://www.tiktok.com/@creator'
    );
  });

  it('builds TikTok URL adding @ when handle has none', () => {
    expect(buildAccountProfileUrl('tiktok', 'creator')).toBe(
      'https://www.tiktok.com/@creator'
    );
  });

  it('does not double-prefix @ for TikTok', () => {
    const url = buildAccountProfileUrl('tiktok', '@user');
    expect(url).not.toContain('@@');
  });

  // ── Instagram ────────────────────────────────────────────────────────────
  it('builds Instagram URL stripping leading @ from handle', () => {
    expect(buildAccountProfileUrl('instagram', '@influencer')).toBe(
      'https://www.instagram.com/influencer/'
    );
  });

  it('builds Instagram URL when handle has no @', () => {
    expect(buildAccountProfileUrl('instagram', 'influencer')).toBe(
      'https://www.instagram.com/influencer/'
    );
  });

  it('Instagram URL ends with trailing slash', () => {
    expect(buildAccountProfileUrl('instagram', 'test')).toMatch(/\/$/);
  });

  // ── General ──────────────────────────────────────────────────────────────
  it('returns a valid URL for all three platforms', () => {
    for (const platform of ['youtube', 'tiktok', 'instagram'] as const) {
      const url = buildAccountProfileUrl(platform, 'testhandle');
      expect(() => new URL(url)).not.toThrow();
    }
  });
});
