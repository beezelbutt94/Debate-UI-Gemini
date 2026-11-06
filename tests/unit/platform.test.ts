import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform()', () => {
  // ── TikTok ──────────────────────────────────────────────────────────────
  it('detects plain tiktok.com URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@creator/video/123')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@creator/video/123')).toBe('tiktok');
  });

  it('detects tiktok subdomain (vm.tiktok.com)', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc123')).toBe('tiktok');
  });

  it('detects tiktok short link (m.tiktok.com)', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/999')).toBe('tiktok');
  });

  // ── YouTube Shorts ───────────────────────────────────────────────────────
  it('detects youtube.com /shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com without www + /shorts/', () => {
    expect(detectPlatform('https://youtube.com/shorts/xyz')).toBe('youtube_shorts');
  });

  it('detects youtu.be short link', () => {
    expect(detectPlatform('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('does NOT detect regular youtube.com (no /shorts/)', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc')).toBeNull();
  });

  it('does NOT detect youtube.com/channel/ as shorts', () => {
    expect(detectPlatform('https://www.youtube.com/channel/UC123')).toBeNull();
  });

  // ── Facebook Reels ───────────────────────────────────────────────────────
  it('detects facebook.com /reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects facebook.com without www + /reel/', () => {
    expect(detectPlatform('https://facebook.com/reel/999')).toBe('facebook_reels');
  });

  it('detects fb.watch short link', () => {
    expect(detectPlatform('https://fb.watch/abc123')).toBe('facebook_reels');
  });

  it('detects facebook subdomain + /reel/', () => {
    expect(detectPlatform('https://m.facebook.com/reel/555')).toBe('facebook_reels');
  });

  it('does NOT detect generic facebook.com post (no /reel/)', () => {
    expect(detectPlatform('https://www.facebook.com/someuser/posts/123')).toBeNull();
  });

  // ── Null / invalid ───────────────────────────────────────────────────────
  it('returns null for a non-platform URL', () => {
    expect(detectPlatform('https://example.com/video')).toBeNull();
  });

  it('returns null for a bare string that is not a URL', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for instagram URL (not supported)', () => {
    expect(detectPlatform('https://www.instagram.com/p/abc123/')).toBeNull();
  });

  it('returns null for twitter/x URL', () => {
    expect(detectPlatform('https://twitter.com/i/status/123')).toBeNull();
  });

  it('returns null for a URL with tiktok in the path but wrong host', () => {
    expect(detectPlatform('https://example.com/tiktok/video')).toBeNull();
  });
});

describe('buildAccountProfileUrl()', () => {
  // ── YouTube ──────────────────────────────────────────────────────────────
  it('prefixes @ for YouTube handle without @', () => {
    expect(buildAccountProfileUrl('youtube', 'mkbhd')).toBe('https://www.youtube.com/@mkbhd');
  });

  it('keeps existing @ for YouTube handle', () => {
    expect(buildAccountProfileUrl('youtube', '@mkbhd')).toBe('https://www.youtube.com/@mkbhd');
  });

  it('handles YouTube handle with uppercase', () => {
    expect(buildAccountProfileUrl('youtube', 'MKBHD')).toBe('https://www.youtube.com/@MKBHD');
  });

  // ── TikTok ───────────────────────────────────────────────────────────────
  it('strips leading @ for TikTok handle', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe(
      'https://www.tiktok.com/@charlidamelio'
    );
  });

  it('adds @ for TikTok handle without it', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe(
      'https://www.tiktok.com/@charlidamelio'
    );
  });

  it('handles double @ in TikTok handle gracefully', () => {
    // replace(/^@/, '') removes only the first @
    expect(buildAccountProfileUrl('tiktok', '@@user')).toBe('https://www.tiktok.com/@@user');
  });

  // ── Instagram ────────────────────────────────────────────────────────────
  it('strips leading @ for Instagram handle', () => {
    expect(buildAccountProfileUrl('instagram', '@cristiano')).toBe(
      'https://www.instagram.com/cristiano/'
    );
  });

  it('builds Instagram URL without @ in handle', () => {
    expect(buildAccountProfileUrl('instagram', 'cristiano')).toBe(
      'https://www.instagram.com/cristiano/'
    );
  });

  it('URL ends with trailing slash for Instagram', () => {
    const url = buildAccountProfileUrl('instagram', 'user123');
    expect(url.endsWith('/')).toBe(true);
  });
});
