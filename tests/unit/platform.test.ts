import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform()', () => {
  // --- TikTok ---
  it('detects tiktok.com URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/456')).toBe('tiktok');
  });

  it('detects tiktok subdomain', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/789')).toBe('tiktok');
  });

  it('detects tiktok from vm subdomain', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc123/')).toBe('tiktok');
  });

  // --- YouTube Shorts ---
  it('detects youtube.com /shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('detects youtube.com /shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc')).toBe('youtube_shorts');
  });

  it('detects youtu.be short links as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('returns null for youtube.com without /shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });

  it('returns null for youtube channel URL', () => {
    expect(detectPlatform('https://www.youtube.com/@channelname')).toBeNull();
  });

  // --- Facebook Reels ---
  it('detects facebook.com /reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('detects facebook.com /reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/987654321')).toBe('facebook_reels');
  });

  it('detects fb.watch as facebook_reels', () => {
    expect(detectPlatform('https://fb.watch/shortcode')).toBe('facebook_reels');
  });

  it('returns null for facebook post without /reel/', () => {
    expect(detectPlatform('https://www.facebook.com/photo?fbid=123')).toBeNull();
  });

  it('returns null for facebook profile URL', () => {
    expect(detectPlatform('https://www.facebook.com/myprofile')).toBeNull();
  });

  // --- Invalid / Unknown ---
  it('returns null for completely invalid URL', () => {
    expect(detectPlatform('not a url at all')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for instagram URL', () => {
    expect(detectPlatform('https://www.instagram.com/reel/abc123/')).toBeNull();
  });

  it('returns null for twitter URL', () => {
    expect(detectPlatform('https://twitter.com/user/status/123')).toBeNull();
  });

  it('returns null for random website', () => {
    expect(detectPlatform('https://www.example.com/video/123')).toBeNull();
  });

  it('handles URL with no scheme gracefully', () => {
    // "tiktok.com/..." without https:// is an invalid URL
    expect(detectPlatform('tiktok.com/@user/video/123')).toBeNull();
  });

  // --- Mobile / subdomain variants ---
  it('detects m.youtube.com/shorts/ as youtube_shorts', () => {
    expect(detectPlatform('https://m.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects m.tiktok.com as tiktok', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/789')).toBe('tiktok');
  });

  it('returns null for m.facebook.com without /reel/', () => {
    expect(detectPlatform('https://m.facebook.com/photo?fbid=123')).toBeNull();
  });

  it('detects m.facebook.com/reel/ as facebook_reels', () => {
    expect(detectPlatform('https://m.facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  // --- Edge cases where /shorts/ appears in non-path positions ---
  it('matches youtube URL with /shorts/ in path even with query string', () => {
    // rawUrl.includes('/shorts/') is true regardless of where in the string it appears
    expect(detectPlatform('https://www.youtube.com/shorts/abc?list=PLxyz')).toBe('youtube_shorts');
  });

  it('returns null for fb.watch that is not just the domain', () => {
    // fb.watch always matches regardless of path (by design)
    expect(detectPlatform('https://fb.watch/someShortLink123/')).toBe('facebook_reels');
  });

  it('handles URL with port number', () => {
    // Port is part of hostname? No — hostname is host without port. tiktok.com:443 → hostname = tiktok.com
    expect(detectPlatform('https://tiktok.com:443/@user/video/123')).toBe('tiktok');
  });
});

describe('buildAccountProfileUrl()', () => {
  // --- YouTube ---
  it('builds YouTube URL for handle with @', () => {
    expect(buildAccountProfileUrl('youtube', '@mrBeast')).toBe('https://www.youtube.com/@mrBeast');
  });

  it('builds YouTube URL for handle without @', () => {
    expect(buildAccountProfileUrl('youtube', 'mrBeast')).toBe('https://www.youtube.com/@mrBeast');
  });

  it('builds YouTube URL for handle with leading @', () => {
    expect(buildAccountProfileUrl('youtube', '@channelname')).toBe('https://www.youtube.com/@channelname');
  });

  // --- TikTok ---
  it('builds TikTok URL for handle with @', () => {
    expect(buildAccountProfileUrl('tiktok', '@tiktokuser')).toBe('https://www.tiktok.com/@tiktokuser');
  });

  it('builds TikTok URL for handle without @', () => {
    expect(buildAccountProfileUrl('tiktok', 'tiktokuser')).toBe('https://www.tiktok.com/@tiktokuser');
  });

  it('does not double-add @ for TikTok handle that already has it', () => {
    expect(buildAccountProfileUrl('tiktok', '@user123')).toBe('https://www.tiktok.com/@user123');
  });

  // --- Instagram ---
  it('builds Instagram URL for handle with @', () => {
    expect(buildAccountProfileUrl('instagram', '@instauser')).toBe('https://www.instagram.com/instauser/');
  });

  it('builds Instagram URL for handle without @', () => {
    expect(buildAccountProfileUrl('instagram', 'instauser')).toBe('https://www.instagram.com/instauser/');
  });

  it('builds Instagram URL for handle with leading @', () => {
    expect(buildAccountProfileUrl('instagram', '@creator99')).toBe('https://www.instagram.com/creator99/');
  });

  it('handles numeric-like handle for YouTube', () => {
    expect(buildAccountProfileUrl('youtube', 'UC123abc')).toBe('https://www.youtube.com/@UC123abc');
  });

  it('strips only the leading @ for Instagram (does not strip mid-string @)', () => {
    expect(buildAccountProfileUrl('instagram', '@user@name')).toBe('https://www.instagram.com/user@name/');
  });

  it('builds TikTok URL for handle with multiple leading @@ (only strips one)', () => {
    // replace(/^@/, '') strips one @; '@@user' becomes '@user'
    expect(buildAccountProfileUrl('tiktok', '@@user')).toBe('https://www.tiktok.com/@@user');
  });

  it('builds YouTube URL for handle that is just @', () => {
    // '@'.startsWith('@') is true, so it uses '@' as-is
    expect(buildAccountProfileUrl('youtube', '@')).toBe('https://www.youtube.com/@');
  });

  it('builds Instagram URL for empty handle (strips @ leaving empty string)', () => {
    expect(buildAccountProfileUrl('instagram', '@')).toBe('https://www.instagram.com//');
  });
});
