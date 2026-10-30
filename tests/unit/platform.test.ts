import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform', () => {
  // ── TikTok ──────────────────────────────────────────────────────────────
  it('detects tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok subdomain', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc123/')).toBe('tiktok');
  });

  // ── YouTube Shorts ───────────────────────────────────────────────────────
  it('detects youtube.com/shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abcDEF')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abcDEF')).toBe('youtube_shorts');
  });

  it('detects youtu.be short links', () => {
    expect(detectPlatform('https://youtu.be/abcDEF')).toBe('youtube_shorts');
  });

  it('returns null for youtube.com watch links (not shorts)', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abcDEF')).toBeNull();
  });

  // ── Facebook Reels ───────────────────────────────────────────────────────
  it('detects facebook.com/reel/', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('detects facebook.com/reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('detects fb.watch shortlinks', () => {
    expect(detectPlatform('https://fb.watch/abc123/')).toBe('facebook_reels');
  });

  it('returns null for facebook.com non-reel URL', () => {
    expect(detectPlatform('https://www.facebook.com/user/videos/123')).toBeNull();
  });

  // ── Unknown / invalid ────────────────────────────────────────────────────
  it('returns null for unknown domain', () => {
    expect(detectPlatform('https://instagram.com/p/abc123/')).toBeNull();
  });

  it('returns null for invalid URL', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for plain text', () => {
    expect(detectPlatform('tiktok.com')).toBeNull();
  });

  it('returns null for twitter/X URL', () => {
    expect(detectPlatform('https://x.com/user/status/123')).toBeNull();
  });

  // ── Mobile subdomains ────────────────────────────────────────────────────
  it('detects m.tiktok.com', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects m.youtube.com/shorts/', () => {
    expect(detectPlatform('https://m.youtube.com/shorts/abcDEF')).toBe('youtube_shorts');
  });

  it('returns null for m.youtube.com watch URL (not shorts)', () => {
    expect(detectPlatform('https://m.youtube.com/watch?v=abcDEF')).toBeNull();
  });

  it('detects m.facebook.com/reel/', () => {
    expect(detectPlatform('https://m.facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('returns null for m.facebook.com non-reel URL', () => {
    expect(detectPlatform('https://m.facebook.com/user/videos/123')).toBeNull();
  });
});

describe('buildAccountProfileUrl', () => {
  // ── YouTube ──────────────────────────────────────────────────────────────
  it('builds youtube URL for handle with @', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('builds youtube URL for handle without @, adds it', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('does not double-add @ for youtube', () => {
    expect(buildAccountProfileUrl('youtube', '@channel')).toBe('https://www.youtube.com/@channel');
  });

  // ── TikTok ──────────────────────────────────────────────────────────────
  it('builds tiktok URL for handle without @', () => {
    expect(buildAccountProfileUrl('tiktok', 'khaby.lame')).toBe('https://www.tiktok.com/@khaby.lame');
  });

  it('builds tiktok URL for handle with @, strips it then re-adds', () => {
    expect(buildAccountProfileUrl('tiktok', '@khaby.lame')).toBe('https://www.tiktok.com/@khaby.lame');
  });

  it('does not double-@ for tiktok', () => {
    expect(buildAccountProfileUrl('tiktok', '@@user')).toBe('https://www.tiktok.com/@@user');
  });

  // ── Instagram ────────────────────────────────────────────────────────────
  it('builds instagram URL for handle without @', () => {
    expect(buildAccountProfileUrl('instagram', 'natgeo')).toBe('https://www.instagram.com/natgeo/');
  });

  it('builds instagram URL for handle with @, strips it', () => {
    expect(buildAccountProfileUrl('instagram', '@natgeo')).toBe('https://www.instagram.com/natgeo/');
  });

  it('instagram URL ends with trailing slash', () => {
    const url = buildAccountProfileUrl('instagram', 'someone');
    expect(url.endsWith('/')).toBe(true);
  });
});
