import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ─── detectPlatform ───────────────────────────────────────────────────────────

describe('detectPlatform()', () => {
  // TikTok
  it('detects tiktok.com URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@creator/video/1234567890')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@creator')).toBe('tiktok');
  });

  it('detects tiktok subdomain', () => {
    expect(detectPlatform('https://m.tiktok.com/@creator/video/123')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com/shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtu.be short links as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('rejects youtube.com without /shorts/ path', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('rejects youtube.com channel pages', () => {
    expect(detectPlatform('https://www.youtube.com/@channel')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com/reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('detects facebook.com reel without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('detects fb.watch URLs', () => {
    expect(detectPlatform('https://fb.watch/abcXYZ/')).toBe('facebook_reels');
  });

  it('rejects facebook.com non-reel pages', () => {
    expect(detectPlatform('https://www.facebook.com/photo/12345')).toBeNull();
  });

  it('rejects facebook.com marketplace page', () => {
    expect(detectPlatform('https://www.facebook.com/marketplace/item/123')).toBeNull();
  });

  // Null cases
  it('returns null for invalid URL string', () => {
    expect(detectPlatform('not a url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for instagram URL', () => {
    expect(detectPlatform('https://www.instagram.com/reel/abc123/')).toBeNull();
  });

  it('returns null for twitter/X URL', () => {
    expect(detectPlatform('https://twitter.com/user/status/123')).toBeNull();
  });

  it('returns null for random website', () => {
    expect(detectPlatform('https://example.com/video/123')).toBeNull();
  });

  // YouTube subdomains
  it('detects music.youtube.com/shorts/ as youtube_shorts', () => {
    expect(detectPlatform('https://music.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('rejects music.youtube.com without /shorts/', () => {
    expect(detectPlatform('https://music.youtube.com/watch?v=abc')).toBeNull();
  });

  // Facebook subdomains
  it('detects m.facebook.com/reel/ as facebook_reels', () => {
    expect(detectPlatform('https://m.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  // Facebook plural path (not supported by the function)
  it('returns null for facebook.com/reels/ (plural path)', () => {
    expect(detectPlatform('https://www.facebook.com/reels/123456789')).toBeNull();
  });

  // HTTP scheme support
  it('detects tiktok via http scheme', () => {
    expect(detectPlatform('http://tiktok.com/@creator')).toBe('tiktok');
  });

  it('detects youtube shorts via http scheme', () => {
    expect(detectPlatform('http://www.youtube.com/shorts/xyz')).toBe('youtube_shorts');
  });

  it('detects facebook reels via http scheme', () => {
    expect(detectPlatform('http://www.facebook.com/reel/777')).toBe('facebook_reels');
  });

  // Query params and fragments
  it('detects tiktok URL with query params', () => {
    expect(detectPlatform('https://www.tiktok.com/@creator/video/123?utm_source=test')).toBe('tiktok');
  });

  it('detects youtube shorts URL with query params', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc?feature=share')).toBe('youtube_shorts');
  });

  it('detects fb.watch URL with query params', () => {
    expect(detectPlatform('https://fb.watch/abcXYZ/?s=3')).toBe('facebook_reels');
  });

  // Reject ambiguous but not a URL
  it('returns null for URL with only scheme', () => {
    expect(detectPlatform('https://')).toBeNull();
  });
});

// ─── buildAccountProfileUrl ───────────────────────────────────────────────────

describe('buildAccountProfileUrl()', () => {
  // YouTube
  it('builds youtube URL with @ handle', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('prepends @ to youtube handle that lacks it', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('does not double-prefix @@ for youtube', () => {
    expect(buildAccountProfileUrl('youtube', '@Channel')).toBe('https://www.youtube.com/@Channel');
  });

  // TikTok
  it('builds tiktok URL stripping leading @', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe(
      'https://www.tiktok.com/@charlidamelio'
    );
  });

  it('builds tiktok URL adding @ for handle without it', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe(
      'https://www.tiktok.com/@charlidamelio'
    );
  });

  it('does not double @@ for tiktok', () => {
    expect(buildAccountProfileUrl('tiktok', '@username')).toBe(
      'https://www.tiktok.com/@username'
    );
  });

  // Instagram
  it('builds instagram URL stripping leading @', () => {
    expect(buildAccountProfileUrl('instagram', '@therock')).toBe(
      'https://www.instagram.com/therock/'
    );
  });

  it('builds instagram URL for handle without @', () => {
    expect(buildAccountProfileUrl('instagram', 'therock')).toBe(
      'https://www.instagram.com/therock/'
    );
  });

  it('does not double @@ for instagram', () => {
    expect(buildAccountProfileUrl('instagram', '@user')).toBe(
      'https://www.instagram.com/user/'
    );
  });

  // Return type
  it('always returns a string', () => {
    expect(typeof buildAccountProfileUrl('youtube', 'test')).toBe('string');
    expect(typeof buildAccountProfileUrl('tiktok', 'test')).toBe('string');
    expect(typeof buildAccountProfileUrl('instagram', 'test')).toBe('string');
  });

  // Edge: empty string handle
  it('youtube with empty handle prepends @ alone', () => {
    expect(buildAccountProfileUrl('youtube', '')).toBe('https://www.youtube.com/@');
  });

  it('tiktok with empty handle produces tiktok.com/@', () => {
    expect(buildAccountProfileUrl('tiktok', '')).toBe('https://www.tiktok.com/@');
  });

  it('instagram with empty handle produces trailing slash only', () => {
    expect(buildAccountProfileUrl('instagram', '')).toBe('https://www.instagram.com//');
  });

  // URLs always start with the expected base
  it('youtube URL always starts with https://www.youtube.com/', () => {
    const url = buildAccountProfileUrl('youtube', 'creator');
    expect(url.startsWith('https://www.youtube.com/')).toBe(true);
  });

  it('tiktok URL always starts with https://www.tiktok.com/@', () => {
    const url = buildAccountProfileUrl('tiktok', 'creator');
    expect(url.startsWith('https://www.tiktok.com/@')).toBe(true);
  });

  it('instagram URL always starts with https://www.instagram.com/', () => {
    const url = buildAccountProfileUrl('instagram', 'creator');
    expect(url.startsWith('https://www.instagram.com/')).toBe(true);
  });

  it('instagram URL always ends with /', () => {
    const url = buildAccountProfileUrl('instagram', 'somehandle');
    expect(url.endsWith('/')).toBe(true);
  });

  // Numeric handles
  it('tiktok with numeric-looking handle', () => {
    expect(buildAccountProfileUrl('tiktok', '12345')).toBe('https://www.tiktok.com/@12345');
  });

  it('youtube with numeric-looking handle prepends @', () => {
    expect(buildAccountProfileUrl('youtube', '99999')).toBe('https://www.youtube.com/@99999');
  });
});
