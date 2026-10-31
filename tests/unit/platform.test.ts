import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ─── detectPlatform ──────────────────────────────────────────────────────────

describe('detectPlatform', () => {
  // TikTok
  it('detects TikTok from www URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/7123456789')).toBe('tiktok');
  });

  it('detects TikTok from bare domain', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/7123456789')).toBe('tiktok');
  });

  it('detects TikTok from mobile subdomain', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/7123456789')).toBe('tiktok');
  });

  it('detects TikTok from vm.tiktok.com (share link)', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc123/')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects YouTube Shorts from www URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abcDEF123')).toBe('youtube_shorts');
  });

  it('detects YouTube Shorts from bare youtube.com', () => {
    expect(detectPlatform('https://youtube.com/shorts/abcDEF123')).toBe('youtube_shorts');
  });

  it('detects YouTube Shorts from youtube subdomain containing /shorts/', () => {
    expect(detectPlatform('https://music.youtube.com/shorts/abcDEF123')).toBe('youtube_shorts');
  });

  it('detects YouTube Shorts from youtu.be', () => {
    expect(detectPlatform('https://youtu.be/abcDEF123')).toBe('youtube_shorts');
  });

  it('returns null for youtube.com without /shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abcDEF123')).toBeNull();
  });

  it('returns null for youtube.com channel page', () => {
    expect(detectPlatform('https://www.youtube.com/@channel')).toBeNull();
  });

  // Facebook Reels
  it('detects Facebook Reels from reel URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/1234567890')).toBe('facebook_reels');
  });

  it('detects Facebook Reels from bare facebook.com', () => {
    expect(detectPlatform('https://facebook.com/reel/1234567890')).toBe('facebook_reels');
  });

  it('detects Facebook Reels from mobile subdomain', () => {
    expect(detectPlatform('https://m.facebook.com/reel/7654321')).toBe('facebook_reels');
  });

  it('detects Facebook Reels from fb.watch short link', () => {
    expect(detectPlatform('https://fb.watch/abc123xyz/')).toBe('facebook_reels');
  });

  it('returns null for facebook.com without /reel/', () => {
    expect(detectPlatform('https://www.facebook.com/someuser/posts/123')).toBeNull();
  });

  it('returns null for facebook.com home page', () => {
    expect(detectPlatform('https://www.facebook.com/')).toBeNull();
  });

  // Invalid / unknown
  it('returns null for a completely invalid URL', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for an unknown platform URL', () => {
    expect(detectPlatform('https://twitter.com/user/status/123')).toBeNull();
  });

  it('returns null for instagram', () => {
    expect(detectPlatform('https://www.instagram.com/reel/abc123/')).toBeNull();
  });

  it('returns null for a plain string without protocol', () => {
    expect(detectPlatform('www.tiktok.com/@user')).toBeNull();
  });

  it('returns null for a URL with similar-but-wrong domain', () => {
    expect(detectPlatform('https://notatiktok.com/@user')).toBeNull();
  });

  it('returns null for a URL with tiktok in the path but wrong host', () => {
    expect(detectPlatform('https://example.com/tiktok.com/@user')).toBeNull();
  });
});

// ─── buildAccountProfileUrl ──────────────────────────────────────────────────

describe('buildAccountProfileUrl', () => {
  // YouTube
  it('builds YouTube URL for handle that already starts with @', () => {
    expect(buildAccountProfileUrl('youtube', '@mkcreator')).toBe('https://www.youtube.com/@mkcreator');
  });

  it('builds YouTube URL for handle without @, prepending it', () => {
    expect(buildAccountProfileUrl('youtube', 'mkcreator')).toBe('https://www.youtube.com/@mkcreator');
  });

  it('builds YouTube URL preserving double-@ edge (handle already has @, no duplication)', () => {
    // startsWith('@') is true, so it keeps the handle as-is
    expect(buildAccountProfileUrl('youtube', '@chan')).toBe('https://www.youtube.com/@chan');
  });

  // TikTok
  it('builds TikTok URL for handle with leading @', () => {
    expect(buildAccountProfileUrl('tiktok', '@creator99')).toBe('https://www.tiktok.com/@creator99');
  });

  it('builds TikTok URL for handle without @, adding it', () => {
    expect(buildAccountProfileUrl('tiktok', 'creator99')).toBe('https://www.tiktok.com/@creator99');
  });

  it('does not double-add @ for TikTok', () => {
    expect(buildAccountProfileUrl('tiktok', '@user')).toBe('https://www.tiktok.com/@user');
  });

  // Instagram
  it('builds Instagram URL for handle with leading @', () => {
    expect(buildAccountProfileUrl('instagram', '@photostar')).toBe('https://www.instagram.com/photostar/');
  });

  it('builds Instagram URL for handle without @', () => {
    expect(buildAccountProfileUrl('instagram', 'photostar')).toBe('https://www.instagram.com/photostar/');
  });

  it('strips only one leading @ for Instagram', () => {
    // Only one leading @ should be stripped
    expect(buildAccountProfileUrl('instagram', '@@double')).toBe('https://www.instagram.com/@double/');
  });

  it('produces correct scheme for all platforms', () => {
    for (const platform of ['youtube', 'tiktok', 'instagram'] as const) {
      const url = buildAccountProfileUrl(platform, 'user');
      expect(url.startsWith('https://')).toBe(true);
    }
  });
});
