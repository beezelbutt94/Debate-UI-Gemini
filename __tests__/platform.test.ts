import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ---------------------------------------------------------------------------
// detectPlatform
// ---------------------------------------------------------------------------

describe('detectPlatform()', () => {
  // --- TikTok ---------------------------------------------------------------
  it('detects www.tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123456')).toBe('tiktok');
  });

  it('detects bare tiktok.com (no www)', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123456')).toBe('tiktok');
  });

  it('detects tiktok subdomain (e.g. vm.tiktok.com)', () => {
    expect(detectPlatform('https://vm.tiktok.com/abcdef/')).toBe('tiktok');
  });

  it('detects m.tiktok.com', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/789')).toBe('tiktok');
  });

  // --- YouTube Shorts -------------------------------------------------------
  it('detects www.youtube.com/shorts', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('detects bare youtube.com/shorts (no www)', () => {
    expect(detectPlatform('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('detects m.youtube.com/shorts (mobile)', () => {
    expect(detectPlatform('https://m.youtube.com/shorts/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('detects youtu.be short links', () => {
    expect(detectPlatform('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('returns null for youtube.com watch URLs (not Shorts)', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });

  it('returns null for youtube.com channel URLs', () => {
    expect(detectPlatform('https://www.youtube.com/@someChannel')).toBeNull();
  });

  // --- Facebook Reels -------------------------------------------------------
  it('detects www.facebook.com/reel/', () => {
    expect(detectPlatform('https://www.facebook.com/reel/1234567890')).toBe('facebook_reels');
  });

  it('detects bare facebook.com/reel/ (no www)', () => {
    expect(detectPlatform('https://facebook.com/reel/1234567890')).toBe('facebook_reels');
  });

  it('detects m.facebook.com/reel/', () => {
    expect(detectPlatform('https://m.facebook.com/reel/1234567890')).toBe('facebook_reels');
  });

  it('detects fb.watch links', () => {
    expect(detectPlatform('https://fb.watch/abcdef/')).toBe('facebook_reels');
  });

  it('returns null for facebook.com page URLs (no /reel/)', () => {
    expect(detectPlatform('https://www.facebook.com/SomePage/videos/123')).toBeNull();
  });

  // --- Invalid / Unknown ----------------------------------------------------
  it('returns null for invalid URL string', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for unknown domain', () => {
    expect(detectPlatform('https://example.com/video/123')).toBeNull();
  });

  it('returns null for instagram.com (not a supported platform in this function)', () => {
    expect(detectPlatform('https://www.instagram.com/reels/abc/')).toBeNull();
  });

  it('returns null for twitter/X URLs', () => {
    expect(detectPlatform('https://twitter.com/user/status/123')).toBeNull();
  });

  it('does NOT misidentify a URL that contains "tiktok.com" in the path (not host)', () => {
    // e.g. a redirect service whose host is something else
    expect(detectPlatform('https://example.com/redirect?to=tiktok.com')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildAccountProfileUrl
// ---------------------------------------------------------------------------

describe('buildAccountProfileUrl()', () => {
  // --- YouTube --------------------------------------------------------------
  it('builds YouTube URL for handle already prefixed with @', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe(
      'https://www.youtube.com/@MrBeast'
    );
  });

  it('builds YouTube URL for handle without @ prefix', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe(
      'https://www.youtube.com/@MrBeast'
    );
  });

  it('does not double-@ on YouTube', () => {
    const url = buildAccountProfileUrl('youtube', '@creator');
    expect(url).toBe('https://www.youtube.com/@creator');
    expect(url).not.toContain('@@');
  });

  // --- TikTok ---------------------------------------------------------------
  it('builds TikTok URL for handle with @ prefix', () => {
    expect(buildAccountProfileUrl('tiktok', '@charli')).toBe(
      'https://www.tiktok.com/@charli'
    );
  });

  it('builds TikTok URL for handle without @ prefix', () => {
    expect(buildAccountProfileUrl('tiktok', 'charli')).toBe(
      'https://www.tiktok.com/@charli'
    );
  });

  it('does not double-@ on TikTok', () => {
    const url = buildAccountProfileUrl('tiktok', '@creator');
    expect(url).toBe('https://www.tiktok.com/@creator');
    expect(url).not.toContain('@@');
  });

  // --- Instagram ------------------------------------------------------------
  it('builds Instagram URL for handle with @ prefix', () => {
    expect(buildAccountProfileUrl('instagram', '@natgeo')).toBe(
      'https://www.instagram.com/natgeo/'
    );
  });

  it('builds Instagram URL for handle without @ prefix', () => {
    expect(buildAccountProfileUrl('instagram', 'natgeo')).toBe(
      'https://www.instagram.com/natgeo/'
    );
  });

  it('does not include @ in the Instagram URL path', () => {
    const url = buildAccountProfileUrl('instagram', '@user');
    expect(url).not.toContain('@');
  });

  it('Instagram URL ends with a trailing slash', () => {
    expect(buildAccountProfileUrl('instagram', 'user')).toMatch(/\/$/);
  });

  // --- Trailing/edge handles ------------------------------------------------
  it('handles handles with uppercase letters (preserves case)', () => {
    expect(buildAccountProfileUrl('youtube', 'BigCreator')).toBe(
      'https://www.youtube.com/@BigCreator'
    );
  });

  it('handles handles with underscores', () => {
    expect(buildAccountProfileUrl('tiktok', 'my_channel')).toBe(
      'https://www.tiktok.com/@my_channel'
    );
  });
});
