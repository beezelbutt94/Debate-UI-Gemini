import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ─── detectPlatform ───────────────────────────────────────────────────────────

describe('detectPlatform', () => {
  // TikTok
  it('detects tiktok.com video URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/456')).toBe('tiktok');
  });

  it('detects tiktok subdomain (m.tiktok.com)', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/789')).toBe('tiktok');
  });

  it('detects vm.tiktok.com short link', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc123')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com/shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/xyz')).toBe('youtube_shorts');
  });

  it('detects youtu.be short link as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('returns null for regular youtube.com watch URL (not shorts)', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });

  it('returns null for youtube.com channel URL', () => {
    expect(detectPlatform('https://www.youtube.com/@channel')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com/reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects facebook.com reel without www', () => {
    expect(detectPlatform('https://facebook.com/reel/789')).toBe('facebook_reels');
  });

  it('detects fb.watch URL as facebook_reels', () => {
    expect(detectPlatform('https://fb.watch/abc123/')).toBe('facebook_reels');
  });

  it('returns null for facebook.com post URL (no /reel/)', () => {
    expect(detectPlatform('https://www.facebook.com/user/posts/123')).toBeNull();
  });

  it('returns null for facebook.com video URL (no /reel/)', () => {
    expect(detectPlatform('https://www.facebook.com/video/123')).toBeNull();
  });

  // Other / invalid
  it('returns null for Instagram URL', () => {
    expect(detectPlatform('https://www.instagram.com/p/abc')).toBeNull();
  });

  it('returns null for Twitter/X URL', () => {
    expect(detectPlatform('https://twitter.com/user/status/123')).toBeNull();
  });

  it('returns null for a completely random URL', () => {
    expect(detectPlatform('https://example.com/path')).toBeNull();
  });

  it('returns null for an invalid (non-parseable) string', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a URL with no host', () => {
    expect(detectPlatform('ftp://')).toBeNull();
  });

  it('is not confused by tiktok appearing in query params of another URL', () => {
    expect(detectPlatform('https://example.com/?redirect=tiktok.com')).toBeNull();
  });
});

// ─── buildAccountProfileUrl ───────────────────────────────────────────────────

describe('buildAccountProfileUrl', () => {
  // YouTube
  it('builds YouTube URL for handle with leading @', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe(
      'https://www.youtube.com/@MrBeast'
    );
  });

  it('builds YouTube URL for handle without leading @', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe(
      'https://www.youtube.com/@MrBeast'
    );
  });

  it('does not double the @ for YouTube', () => {
    const url = buildAccountProfileUrl('youtube', '@creator');
    expect(url).not.toContain('@@');
  });

  // TikTok
  it('builds TikTok URL for handle with leading @', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe(
      'https://www.tiktok.com/@charlidamelio'
    );
  });

  it('builds TikTok URL for handle without leading @', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe(
      'https://www.tiktok.com/@charlidamelio'
    );
  });

  it('does not double the @ for TikTok', () => {
    const url = buildAccountProfileUrl('tiktok', '@user');
    expect(url).not.toContain('@@');
  });

  // Instagram
  it('builds Instagram URL for handle with leading @', () => {
    expect(buildAccountProfileUrl('instagram', '@nasa')).toBe(
      'https://www.instagram.com/nasa/'
    );
  });

  it('builds Instagram URL for handle without leading @', () => {
    expect(buildAccountProfileUrl('instagram', 'nasa')).toBe(
      'https://www.instagram.com/nasa/'
    );
  });

  it('Instagram URL ends with trailing slash', () => {
    const url = buildAccountProfileUrl('instagram', 'user');
    expect(url).toMatch(/\/$/);
  });

  it('does not include @ in Instagram URL', () => {
    const url = buildAccountProfileUrl('instagram', '@user');
    expect(url).not.toContain('@');
  });

  // URL validity
  it('all returned URLs start with https://', () => {
    const platforms: Array<'youtube' | 'tiktok' | 'instagram'> = ['youtube', 'tiktok', 'instagram'];
    for (const p of platforms) {
      expect(buildAccountProfileUrl(p, 'testHandle')).toMatch(/^https:\/\//);
    }
  });
});
