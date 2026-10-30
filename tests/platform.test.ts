import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ─── detectPlatform ────────────────────────────────────────────────────────

describe('detectPlatform()', () => {
  // TikTok
  it('identifies plain tiktok.com URLs', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/12345')).toBe('tiktok');
  });

  it('identifies tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/12345')).toBe('tiktok');
  });

  it('identifies tiktok subdomain URLs', () => {
    expect(detectPlatform('https://vm.tiktok.com/abcdef')).toBe('tiktok');
  });

  // YouTube Shorts
  it('identifies youtube.com /shorts/ URLs', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('identifies youtube.com /shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('identifies youtu.be URLs as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('does NOT identify regular youtube.com/watch URLs', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('does NOT identify youtube.com channel URLs (no /shorts/)', () => {
    expect(detectPlatform('https://www.youtube.com/@channel')).toBeNull();
  });

  // Facebook Reels
  it('identifies facebook.com /reel/ URLs', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('identifies facebook.com /reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('identifies fb.watch URLs as facebook_reels', () => {
    expect(detectPlatform('https://fb.watch/abc123/')).toBe('facebook_reels');
  });

  it('identifies subdomain facebook.com /reel/', () => {
    expect(detectPlatform('https://m.facebook.com/reel/9876')).toBe('facebook_reels');
  });

  it('does NOT identify facebook.com non-reel URLs', () => {
    expect(detectPlatform('https://www.facebook.com/user/posts/12345')).toBeNull();
  });

  // Invalid / unknown
  it('returns null for invalid URL', () => {
    expect(detectPlatform('not a url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for instagram URLs', () => {
    expect(detectPlatform('https://www.instagram.com/reel/abc')).toBeNull();
  });

  it('returns null for twitter/X URLs', () => {
    expect(detectPlatform('https://x.com/user/status/123')).toBeNull();
  });

  it('returns null for a random domain', () => {
    expect(detectPlatform('https://example.com/shorts/abc')).toBeNull();
  });

  it('returns null for malformed tiktok-like URL with wrong host', () => {
    expect(detectPlatform('https://tiktok.net/@user/video/123')).toBeNull();
  });
});

// ─── buildAccountProfileUrl ───────────────────────────────────────────────

describe('buildAccountProfileUrl()', () => {
  // YouTube
  it('builds youtube URL with @ prefix', () => {
    expect(buildAccountProfileUrl('youtube', '@creator')).toBe('https://www.youtube.com/@creator');
  });

  it('adds @ prefix when missing for youtube', () => {
    expect(buildAccountProfileUrl('youtube', 'creator')).toBe('https://www.youtube.com/@creator');
  });

  it('does not double-prefix @ for youtube', () => {
    expect(buildAccountProfileUrl('youtube', '@creator')).toBe('https://www.youtube.com/@creator');
  });

  // TikTok
  it('builds tiktok URL stripping leading @', () => {
    expect(buildAccountProfileUrl('tiktok', '@creator')).toBe('https://www.tiktok.com/@creator');
  });

  it('builds tiktok URL adding @ when missing', () => {
    expect(buildAccountProfileUrl('tiktok', 'creator')).toBe('https://www.tiktok.com/@creator');
  });

  it('does not double @ for tiktok handle with @', () => {
    expect(buildAccountProfileUrl('tiktok', '@creator')).toBe('https://www.tiktok.com/@creator');
  });

  // Instagram
  it('builds instagram URL stripping leading @', () => {
    expect(buildAccountProfileUrl('instagram', '@creator')).toBe('https://www.instagram.com/creator/');
  });

  it('builds instagram URL without @ in handle', () => {
    expect(buildAccountProfileUrl('instagram', 'creator')).toBe('https://www.instagram.com/creator/');
  });

  it('includes trailing slash for instagram', () => {
    const url = buildAccountProfileUrl('instagram', 'test_user');
    expect(url.endsWith('/')).toBe(true);
  });

  // Edge cases
  it('handles handle with dots for youtube', () => {
    expect(buildAccountProfileUrl('youtube', '@my.channel')).toBe('https://www.youtube.com/@my.channel');
  });

  it('handles handle with underscores for tiktok', () => {
    expect(buildAccountProfileUrl('tiktok', 'my_handle')).toBe('https://www.tiktok.com/@my_handle');
  });
});
