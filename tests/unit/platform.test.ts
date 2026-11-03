import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ---------------------------------------------------------------------------
// detectPlatform
// ---------------------------------------------------------------------------

describe('detectPlatform()', () => {
  // TikTok ----------------------------------------------------------------
  it('detects tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/@creator/video/7291234567890')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@creator/video/1234')).toBe('tiktok');
  });

  it('detects a tiktok subdomain', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc123')).toBe('tiktok');
  });

  // YouTube Shorts ---------------------------------------------------------
  it('detects youtube.com /shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com /shorts/ URL without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/xyz')).toBe('youtube_shorts');
  });

  it('detects youtu.be short link', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('does NOT detect youtube.com watch URL as shorts', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('does NOT detect youtube.com channel page as shorts', () => {
    expect(detectPlatform('https://www.youtube.com/@creator')).toBeNull();
  });

  // Facebook Reels ---------------------------------------------------------
  it('detects facebook.com /reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/1234567890')).toBe('facebook_reels');
  });

  it('detects facebook.com /reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/1234567890')).toBe('facebook_reels');
  });

  it('detects fb.watch URL', () => {
    expect(detectPlatform('https://fb.watch/abcdef')).toBe('facebook_reels');
  });

  it('detects facebook subdomain with /reel/', () => {
    expect(detectPlatform('https://m.facebook.com/reel/9876543210')).toBe('facebook_reels');
  });

  it('does NOT detect facebook.com post URL as reels', () => {
    expect(detectPlatform('https://www.facebook.com/someuser/posts/1234')).toBeNull();
  });

  // Null / unknown ---------------------------------------------------------
  it('returns null for an Instagram URL', () => {
    expect(detectPlatform('https://www.instagram.com/p/abc123/')).toBeNull();
  });

  it('returns null for a Twitter/X URL', () => {
    expect(detectPlatform('https://twitter.com/user/status/123')).toBeNull();
  });

  it('returns null for a random URL', () => {
    expect(detectPlatform('https://example.com/video/123')).toBeNull();
  });

  it('returns null for a malformed (non-URL) string', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildAccountProfileUrl
// ---------------------------------------------------------------------------

describe('buildAccountProfileUrl()', () => {
  // YouTube ----------------------------------------------------------------
  it('builds youtube URL for a handle that already starts with @', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('builds youtube URL for a handle without @', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('does not double the @ for youtube', () => {
    const url = buildAccountProfileUrl('youtube', '@channel');
    expect(url).not.toContain('@@');
  });

  // TikTok ----------------------------------------------------------------
  it('builds tiktok URL and strips leading @', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('builds tiktok URL for handle without @', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('does not double the @ for tiktok', () => {
    const url = buildAccountProfileUrl('tiktok', '@handle');
    expect(url).not.toContain('@@');
  });

  // Instagram -------------------------------------------------------------
  it('builds instagram URL and strips leading @', () => {
    expect(buildAccountProfileUrl('instagram', '@nasa')).toBe('https://www.instagram.com/nasa/');
  });

  it('builds instagram URL for handle without @', () => {
    expect(buildAccountProfileUrl('instagram', 'nasa')).toBe('https://www.instagram.com/nasa/');
  });

  it('does not double the @ for instagram', () => {
    const url = buildAccountProfileUrl('instagram', '@handle');
    expect(url).not.toContain('@');
  });

  it('instagram URL ends with trailing slash', () => {
    expect(buildAccountProfileUrl('instagram', 'someuser')).toMatch(/\/$/);
  });

  // Edge cases -------------------------------------------------------------
  it('handles handles with numbers and underscores for tiktok', () => {
    const url = buildAccountProfileUrl('tiktok', 'user_123');
    expect(url).toBe('https://www.tiktok.com/@user_123');
  });
});
