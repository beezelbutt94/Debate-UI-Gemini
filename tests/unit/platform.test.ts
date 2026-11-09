import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ─── detectPlatform ──────────────────────────────────────────────────────────

describe('detectPlatform()', () => {
  // ── TikTok ────────────────────────────────────────────────────────────────
  it('detects a standard TikTok video URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@creator/video/1234567890')).toBe('tiktok');
  });

  it('detects a TikTok URL without www', () => {
    expect(detectPlatform('https://tiktok.com/@creator/video/1234567890')).toBe('tiktok');
  });

  it('detects a TikTok mobile subdomain URL (vm.tiktok.com)', () => {
    expect(detectPlatform('https://vm.tiktok.com/ABCDEF/')).toBe('tiktok');
  });

  // ── YouTube Shorts ────────────────────────────────────────────────────────
  it('detects a YouTube Shorts URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('detects a YouTube Shorts URL without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects a youtu.be short link (always treated as Shorts)', () => {
    expect(detectPlatform('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('returns null for a regular YouTube watch URL (not a Short)', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });

  it('returns null for youtube.com with no /shorts/ path', () => {
    expect(detectPlatform('https://www.youtube.com/channel/UCXYZ')).toBeNull();
  });

  // ── Facebook Reels ────────────────────────────────────────────────────────
  it('detects a Facebook Reel URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/1234567890')).toBe('facebook_reels');
  });

  it('detects a Facebook Reel URL without www', () => {
    expect(detectPlatform('https://facebook.com/reel/1234567890')).toBe('facebook_reels');
  });

  it('detects an fb.watch short link', () => {
    expect(detectPlatform('https://fb.watch/ABCDEF')).toBe('facebook_reels');
  });

  it('detects a Facebook reel with /reels/ path variant', () => {
    expect(detectPlatform('https://www.facebook.com/creator/videos/reel/1234567890')).toBe('facebook_reels');
  });

  it('returns null for a Facebook post URL (no reel)', () => {
    expect(detectPlatform('https://www.facebook.com/creator/posts/1234567890')).toBeNull();
  });

  // ── Unsupported / invalid ─────────────────────────────────────────────────
  it('returns null for an Instagram URL', () => {
    expect(detectPlatform('https://www.instagram.com/p/ABCDEF/')).toBeNull();
  });

  it('returns null for a Twitter/X URL', () => {
    expect(detectPlatform('https://twitter.com/user/status/123')).toBeNull();
  });

  it('returns null for a totally random URL', () => {
    expect(detectPlatform('https://example.com/video/123')).toBeNull();
  });

  it('returns null for a completely invalid string', () => {
    expect(detectPlatform('not a url at all')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('detects tiktok.com with no path as tiktok (host match only)', () => {
    expect(detectPlatform('https://tiktok.com')).toBe('tiktok');
  });
});

// ─── buildAccountProfileUrl ──────────────────────────────────────────────────

describe('buildAccountProfileUrl()', () => {
  // ── youtube ───────────────────────────────────────────────────────────────
  it('builds a YouTube URL for a handle with @', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('builds a YouTube URL for a handle without @, prepending it', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('does not double-add @ for YouTube handles', () => {
    expect(buildAccountProfileUrl('youtube', '@@MrBeast')).toBe('https://www.youtube.com/@@MrBeast');
  });

  // ── tiktok ────────────────────────────────────────────────────────────────
  it('builds a TikTok URL for a handle with @, stripping the leading @', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('builds a TikTok URL for a handle without @', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('strips only one leading @ for TikTok', () => {
    // replace(/^@/, '') removes exactly one leading @
    expect(buildAccountProfileUrl('tiktok', '@creator')).toBe('https://www.tiktok.com/@creator');
  });

  // ── instagram ─────────────────────────────────────────────────────────────
  it('builds an Instagram URL for a handle with @', () => {
    expect(buildAccountProfileUrl('instagram', '@natgeo')).toBe('https://www.instagram.com/natgeo/');
  });

  it('builds an Instagram URL for a handle without @', () => {
    expect(buildAccountProfileUrl('instagram', 'natgeo')).toBe('https://www.instagram.com/natgeo/');
  });

  it('strips only one leading @ for Instagram', () => {
    expect(buildAccountProfileUrl('instagram', '@creator')).toBe('https://www.instagram.com/creator/');
  });

  // ── edge cases ────────────────────────────────────────────────────────────
  it('preserves handles that contain dots and underscores', () => {
    expect(buildAccountProfileUrl('tiktok', 'some.user_name')).toBe('https://www.tiktok.com/@some.user_name');
  });

  it('preserves numeric-only handles', () => {
    expect(buildAccountProfileUrl('youtube', '12345')).toBe('https://www.youtube.com/@12345');
  });
});
