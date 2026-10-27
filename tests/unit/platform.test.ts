import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ── detectPlatform ────────────────────────────────────────────────────────────

describe('detectPlatform()', () => {
  // TikTok
  it('detects www.tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/@creator/video/1234567890')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@creator/video/1234567890')).toBe('tiktok');
  });

  it('detects m.tiktok.com subdomain', () => {
    expect(detectPlatform('https://m.tiktok.com/v/1234567890.html')).toBe('tiktok');
  });

  it('detects vm.tiktok.com subdomain', () => {
    expect(detectPlatform('https://vm.tiktok.com/ZMabc123/')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects www.youtube.com/shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('detects youtu.be short links as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('returns null for youtube.com without /shorts/ path', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });

  it('returns null for youtube.com channel pages', () => {
    expect(detectPlatform('https://www.youtube.com/@creator')).toBeNull();
  });

  it('returns null for youtube.com playlist pages', () => {
    expect(detectPlatform('https://www.youtube.com/playlist?list=PL123')).toBeNull();
  });

  // Facebook Reels
  it('detects www.facebook.com/reel/', () => {
    expect(detectPlatform('https://www.facebook.com/reel/1234567890')).toBe('facebook_reels');
  });

  it('detects facebook.com/reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/1234567890')).toBe('facebook_reels');
  });

  it('detects fb.watch short links', () => {
    expect(detectPlatform('https://fb.watch/abc123/')).toBe('facebook_reels');
  });

  it('returns null for facebook.com/watch/ (not /reel/)', () => {
    expect(detectPlatform('https://www.facebook.com/watch/?v=1234567890')).toBeNull();
  });

  it('returns null for facebook.com regular posts', () => {
    expect(detectPlatform('https://www.facebook.com/someuser/posts/123')).toBeNull();
  });

  // Other platforms / invalid input
  it('returns null for Instagram', () => {
    expect(detectPlatform('https://www.instagram.com/reel/abc123/')).toBeNull();
  });

  it('returns null for Twitter/X', () => {
    expect(detectPlatform('https://twitter.com/i/status/123')).toBeNull();
  });

  it('returns null for completely unrelated URL', () => {
    expect(detectPlatform('https://www.example.com/some/path')).toBeNull();
  });

  it('returns null for invalid URL string', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a URL with no protocol', () => {
    expect(detectPlatform('www.tiktok.com/@creator/video/123')).toBeNull();
  });

  it('returns null for IP address URL', () => {
    expect(detectPlatform('http://192.168.1.1/video/123')).toBeNull();
  });

  it('handles URL with query params for tiktok', () => {
    expect(detectPlatform('https://www.tiktok.com/@creator/video/123?is_from_webapp=1')).toBe('tiktok');
  });

  it('handles YouTube shorts with query params', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc?feature=share')).toBe('youtube_shorts');
  });
});

// ── buildAccountProfileUrl ────────────────────────────────────────────────────

describe('buildAccountProfileUrl()', () => {
  // youtube
  it('youtube: prepends @ when handle has no @', () => {
    expect(buildAccountProfileUrl('youtube', 'mychannel')).toBe('https://www.youtube.com/@mychannel');
  });

  it('youtube: keeps existing @ in handle', () => {
    expect(buildAccountProfileUrl('youtube', '@mychannel')).toBe('https://www.youtube.com/@mychannel');
  });

  it('youtube: handles handle with mixed case', () => {
    expect(buildAccountProfileUrl('youtube', 'MyChannel')).toBe('https://www.youtube.com/@MyChannel');
  });

  // tiktok
  it('tiktok: strips leading @ and re-adds it', () => {
    expect(buildAccountProfileUrl('tiktok', '@creator')).toBe('https://www.tiktok.com/@creator');
  });

  it('tiktok: adds @ when handle has none', () => {
    expect(buildAccountProfileUrl('tiktok', 'creator')).toBe('https://www.tiktok.com/@creator');
  });

  it('tiktok: handles handle with dots and underscores', () => {
    expect(buildAccountProfileUrl('tiktok', 'creator.name_123')).toBe('https://www.tiktok.com/@creator.name_123');
  });

  // instagram
  it('instagram: strips leading @ from handle', () => {
    expect(buildAccountProfileUrl('instagram', '@creator')).toBe('https://www.instagram.com/creator/');
  });

  it('instagram: adds trailing slash when handle has no @', () => {
    expect(buildAccountProfileUrl('instagram', 'creator')).toBe('https://www.instagram.com/creator/');
  });

  it('instagram: handles underscore-heavy handles', () => {
    expect(buildAccountProfileUrl('instagram', '_my_account_')).toBe('https://www.instagram.com/_my_account_/');
  });
});
