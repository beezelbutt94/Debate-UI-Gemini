import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform', () => {
  // ── TikTok ────────────────────────────────────────────────────────────
  it('detects plain tiktok.com URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/456')).toBe('tiktok');
  });

  it('detects subdomain tiktok URL (e.g. vm.tiktok.com)', () => {
    expect(detectPlatform('https://vm.tiktok.com/abcdef/')).toBe('tiktok');
  });

  // ── YouTube Shorts ────────────────────────────────────────────────────
  it('detects youtube.com/shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/xyz')).toBe('youtube_shorts');
  });

  it('detects youtu.be short link as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('does NOT detect regular youtube.com watch URL as shorts', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });

  it('does NOT treat youtube.com/channel/ as shorts', () => {
    expect(detectPlatform('https://www.youtube.com/channel/UCxxxxxx')).toBeNull();
  });

  // ── Facebook Reels ────────────────────────────────────────────────────
  it('detects facebook.com/reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/1234567890')).toBe('facebook_reels');
  });

  it('detects facebook.com/reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/987654')).toBe('facebook_reels');
  });

  it('detects fb.watch URL as facebook_reels', () => {
    expect(detectPlatform('https://fb.watch/abc123/')).toBe('facebook_reels');
  });

  it('does NOT detect plain facebook.com URL without /reel/', () => {
    expect(detectPlatform('https://www.facebook.com/some/page')).toBeNull();
  });

  // ── Unknown / invalid ─────────────────────────────────────────────────
  it('returns null for an arbitrary URL', () => {
    expect(detectPlatform('https://twitter.com/user/status/123')).toBeNull();
  });

  it('returns null for a non-URL string', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for instagram URL (not a supported platform)', () => {
    expect(detectPlatform('https://www.instagram.com/reel/abc123/')).toBeNull();
  });
});

describe('buildAccountProfileUrl', () => {
  // ── YouTube ───────────────────────────────────────────────────────────
  it('builds youtube URL with bare handle (no @)', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('builds youtube URL with handle that already has @', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('builds youtube URL preserving case', () => {
    expect(buildAccountProfileUrl('youtube', 'SomeChannel')).toBe('https://www.youtube.com/@SomeChannel');
  });

  // ── TikTok ────────────────────────────────────────────────────────────
  it('builds tiktok URL stripping leading @', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('builds tiktok URL when handle has no @', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  // ── Instagram ─────────────────────────────────────────────────────────
  it('builds instagram URL stripping leading @', () => {
    expect(buildAccountProfileUrl('instagram', '@natgeo')).toBe('https://www.instagram.com/natgeo/');
  });

  it('builds instagram URL when handle has no @', () => {
    expect(buildAccountProfileUrl('instagram', 'natgeo')).toBe('https://www.instagram.com/natgeo/');
  });

  it('builds instagram URL trailing slash included', () => {
    const url = buildAccountProfileUrl('instagram', 'someone');
    expect(url.endsWith('/')).toBe(true);
  });
});
