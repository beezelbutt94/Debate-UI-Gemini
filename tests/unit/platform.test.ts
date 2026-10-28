import { describe, it, expect } from 'vitest';
import { detectPlatform } from '@/lib/platform';
import { buildAccountProfileUrl } from '@/lib/platform';

// ---------------------------------------------------------------------------
// detectPlatform
// ---------------------------------------------------------------------------
describe('detectPlatform()', () => {
  // TikTok
  it('detects bare tiktok.com URL', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects www.tiktok.com URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects subdomain tiktok URL', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc123/')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com /shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com /shorts/ URL without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtu.be short link as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('does NOT detect youtube.com non-shorts URL', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('does NOT detect youtube.com channel URL', () => {
    expect(detectPlatform('https://www.youtube.com/@channel')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com /reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects facebook.com /reel/ URL without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects fb.watch URL', () => {
    expect(detectPlatform('https://fb.watch/abcdef/')).toBe('facebook_reels');
  });

  it('does NOT detect facebook.com non-reel URL', () => {
    expect(detectPlatform('https://www.facebook.com/someuser/posts/123')).toBeNull();
  });

  it('does NOT detect facebook.com /video/ URL (not /reel/)', () => {
    expect(detectPlatform('https://www.facebook.com/video/123456')).toBeNull();
  });

  // Unknown / invalid
  it('returns null for an unrelated URL', () => {
    expect(detectPlatform('https://instagram.com/reel/abc123')).toBeNull();
  });

  it('returns null for a completely invalid string', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a twitter URL', () => {
    expect(detectPlatform('https://twitter.com/user/status/123')).toBeNull();
  });

  it('does NOT mistake a URL that contains "tiktok.com" as a query param', () => {
    // The URL's host is instagram.com, so it should return null
    expect(detectPlatform('https://instagram.com/redirect?url=tiktok.com')).toBeNull();
  });

  it('handles HTTPS YouTube Shorts from mobile app share', () => {
    expect(detectPlatform('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });
});

// ---------------------------------------------------------------------------
// buildAccountProfileUrl
// ---------------------------------------------------------------------------
describe('buildAccountProfileUrl()', () => {
  // YouTube
  it('builds YouTube URL from handle with @ prefix', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe(
      'https://www.youtube.com/@MrBeast'
    );
  });

  it('builds YouTube URL from handle without @ prefix', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe(
      'https://www.youtube.com/@MrBeast'
    );
  });

  it('does not double the @ for YouTube', () => {
    const url = buildAccountProfileUrl('youtube', '@creator');
    expect(url).toBe('https://www.youtube.com/@creator');
    expect(url).not.toContain('@@');
  });

  // TikTok
  it('builds TikTok URL from handle with @ prefix', () => {
    expect(buildAccountProfileUrl('tiktok', '@user123')).toBe(
      'https://www.tiktok.com/@user123'
    );
  });

  it('builds TikTok URL from handle without @ prefix', () => {
    expect(buildAccountProfileUrl('tiktok', 'user123')).toBe(
      'https://www.tiktok.com/@user123'
    );
  });

  it('does not double the @ for TikTok', () => {
    const url = buildAccountProfileUrl('tiktok', '@creator');
    expect(url).not.toContain('@@');
  });

  // Instagram
  it('builds Instagram URL from handle with @ prefix', () => {
    expect(buildAccountProfileUrl('instagram', '@johndoe')).toBe(
      'https://www.instagram.com/johndoe/'
    );
  });

  it('builds Instagram URL from handle without @ prefix', () => {
    expect(buildAccountProfileUrl('instagram', 'johndoe')).toBe(
      'https://www.instagram.com/johndoe/'
    );
  });

  it('Instagram URL ends with trailing slash', () => {
    const url = buildAccountProfileUrl('instagram', 'creator');
    expect(url.endsWith('/')).toBe(true);
  });

  it('all generated URLs start with https://', () => {
    const platforms = ['youtube', 'tiktok', 'instagram'] as const;
    for (const p of platforms) {
      expect(buildAccountProfileUrl(p, 'testhandle')).toMatch(/^https:\/\//);
    }
  });
});
