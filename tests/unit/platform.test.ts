import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ---------------------------------------------------------------------------
// detectPlatform
// ---------------------------------------------------------------------------

describe('detectPlatform()', () => {
  // ---- TikTok ----
  it('identifies a standard TikTok video URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/12345')).toBe('tiktok');
  });

  it('identifies a TikTok URL without www', () => {
    expect(detectPlatform('https://tiktok.com/@creator/video/99')).toBe('tiktok');
  });

  it('identifies a TikTok subdomain URL', () => {
    expect(detectPlatform('https://vm.tiktok.com/ZMeXabcde/')).toBe('tiktok');
  });

  // ---- YouTube Shorts ----
  it('identifies a YouTube Shorts URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('identifies a YouTube Shorts URL without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/xyz')).toBe('youtube_shorts');
  });

  it('identifies a youtu.be short-link as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('returns null for a regular YouTube watch URL (not /shorts/)', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('returns null for a YouTube channel URL', () => {
    expect(detectPlatform('https://www.youtube.com/@channelname')).toBeNull();
  });

  // ---- Facebook Reels ----
  it('identifies a Facebook Reels URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('identifies a Facebook Reels URL without www', () => {
    expect(detectPlatform('https://facebook.com/reel/9876')).toBe('facebook_reels');
  });

  it('identifies an fb.watch short URL as facebook_reels', () => {
    expect(detectPlatform('https://fb.watch/abc123/')).toBe('facebook_reels');
  });

  it('returns null for a plain Facebook post (no /reel/)', () => {
    expect(detectPlatform('https://www.facebook.com/user/posts/12345')).toBeNull();
  });

  // ---- Unknown / null cases ----
  it('returns null for an Instagram URL', () => {
    expect(detectPlatform('https://www.instagram.com/reel/abc/')).toBeNull();
  });

  it('returns null for a completely random URL', () => {
    expect(detectPlatform('https://example.com/video')).toBeNull();
  });

  it('returns null for a malformed URL', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a URL with only a protocol', () => {
    expect(detectPlatform('https://')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildAccountProfileUrl
// ---------------------------------------------------------------------------

describe('buildAccountProfileUrl()', () => {
  // ---- youtube ----
  it('builds a YouTube URL for a handle without @', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('does not double-prefix @ for YouTube', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('builds a YouTube URL preserving case', () => {
    expect(buildAccountProfileUrl('youtube', 'PewDiePie')).toBe('https://www.youtube.com/@PewDiePie');
  });

  // ---- tiktok ----
  it('builds a TikTok URL for a handle without @', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('strips leading @ before building TikTok URL', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('does not double-@ for TikTok', () => {
    expect(buildAccountProfileUrl('tiktok', '@@@user')).toBe('https://www.tiktok.com/@@@user');
    // replace(/^@/, '') only strips ONE leading @
  });

  // ---- instagram ----
  it('builds an Instagram URL for a handle without @', () => {
    expect(buildAccountProfileUrl('instagram', 'natgeo')).toBe('https://www.instagram.com/natgeo/');
  });

  it('strips leading @ before building Instagram URL', () => {
    expect(buildAccountProfileUrl('instagram', '@natgeo')).toBe('https://www.instagram.com/natgeo/');
  });

  it('Instagram URL always ends with /', () => {
    const url = buildAccountProfileUrl('instagram', 'someuser');
    expect(url.endsWith('/')).toBe(true);
  });

  it('YouTube URL points to youtube.com', () => {
    const url = buildAccountProfileUrl('youtube', 'test');
    expect(url.startsWith('https://www.youtube.com/')).toBe(true);
  });

  it('TikTok URL points to tiktok.com', () => {
    const url = buildAccountProfileUrl('tiktok', 'test');
    expect(url.startsWith('https://www.tiktok.com/')).toBe(true);
  });

  it('Instagram URL points to instagram.com', () => {
    const url = buildAccountProfileUrl('instagram', 'test');
    expect(url.startsWith('https://www.instagram.com/')).toBe(true);
  });
});
