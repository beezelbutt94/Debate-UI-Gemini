import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform()', () => {
  // ── TikTok ──────────────────────────────────────────────────────────────────
  it('detects tiktok from www.tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123456789')).toBe('tiktok');
  });

  it('detects tiktok from bare tiktok.com', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123456789')).toBe('tiktok');
  });

  it('detects tiktok from vm.tiktok.com subdomain', () => {
    expect(detectPlatform('https://vm.tiktok.com/ZMkxyZ/')).toBe('tiktok');
  });

  it('detects tiktok from m.tiktok.com subdomain', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  // ── YouTube Shorts ───────────────────────────────────────────────────────────
  it('detects youtube_shorts from www.youtube.com/shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube_shorts from youtube.com/shorts/', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube_shorts from youtu.be', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('does NOT detect regular youtube watch URL as shorts', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('does NOT detect youtube channel URL as shorts', () => {
    expect(detectPlatform('https://www.youtube.com/@MrBeast')).toBeNull();
  });

  // ── Facebook Reels ───────────────────────────────────────────────────────────
  it('detects facebook_reels from www.facebook.com/reel/', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('detects facebook_reels from facebook.com/reel/', () => {
    expect(detectPlatform('https://facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('detects facebook_reels from fb.watch', () => {
    expect(detectPlatform('https://fb.watch/abc123/')).toBe('facebook_reels');
  });

  it('does NOT detect facebook.com/video/ as reels', () => {
    expect(detectPlatform('https://www.facebook.com/video/123456789')).toBeNull();
  });

  // ── Null cases ───────────────────────────────────────────────────────────────
  it('returns null for an unparseable string', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for instagram URL', () => {
    expect(detectPlatform('https://www.instagram.com/reel/abc123')).toBeNull();
  });

  it('returns null for twitter URL', () => {
    expect(detectPlatform('https://twitter.com/i/status/123')).toBeNull();
  });

  it('returns null for a plain domain with no path', () => {
    expect(detectPlatform('https://www.youtube.com/')).toBeNull();
  });

  it('returns null for tiktok-lookalike domain', () => {
    expect(detectPlatform('https://www.notiktok.com/@user/video/1')).toBeNull();
  });
});

describe('buildAccountProfileUrl()', () => {
  // ── YouTube ──────────────────────────────────────────────────────────────────
  it('builds youtube URL from handle without @', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('builds youtube URL from handle with @ already prefixed', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('builds youtube URL with unusual casing in handle', () => {
    expect(buildAccountProfileUrl('youtube', 'myChannel123')).toBe(
      'https://www.youtube.com/@myChannel123'
    );
  });

  // ── TikTok ───────────────────────────────────────────────────────────────────
  it('builds tiktok URL from handle without @', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe(
      'https://www.tiktok.com/@charlidamelio'
    );
  });

  it('builds tiktok URL from handle with @ prefix', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe(
      'https://www.tiktok.com/@charlidamelio'
    );
  });

  it('does not double-up @ for tiktok', () => {
    const url = buildAccountProfileUrl('tiktok', '@user');
    expect(url).not.toContain('@@');
  });

  // ── Instagram ─────────────────────────────────────────────────────────────────
  it('builds instagram URL from handle without @', () => {
    expect(buildAccountProfileUrl('instagram', 'therock')).toBe(
      'https://www.instagram.com/therock/'
    );
  });

  it('builds instagram URL from handle with @ prefix (stripped)', () => {
    expect(buildAccountProfileUrl('instagram', '@therock')).toBe(
      'https://www.instagram.com/therock/'
    );
  });

  it('instagram URL ends with a trailing slash', () => {
    const url = buildAccountProfileUrl('instagram', 'someone');
    expect(url.endsWith('/')).toBe(true);
  });

  it('does not include @ in instagram URL', () => {
    const url = buildAccountProfileUrl('instagram', '@user');
    expect(url).not.toContain('@');
  });
});
