import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ─── detectPlatform ───────────────────────────────────────────────────────────

describe('detectPlatform', () => {
  // TikTok
  it('detects bare tiktok.com URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects subdomain of tiktok.com', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc123')).toBe('tiktok');
  });

  it('detects tiktok with http', () => {
    expect(detectPlatform('http://www.tiktok.com/@creator')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com shorts URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com shorts without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtu.be as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('does NOT detect regular youtube watch URL as youtube_shorts', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('does NOT detect youtube channel page as youtube_shorts', () => {
    expect(detectPlatform('https://www.youtube.com/@channel')).toBeNull();
  });

  it('detects youtube subdomain shorts', () => {
    expect(detectPlatform('https://m.youtube.com/shorts/abc')).toBe('youtube_shorts');
  });

  // Facebook Reels
  it('detects facebook.com reel URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('detects facebook.com reel without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('detects fb.watch URL', () => {
    expect(detectPlatform('https://fb.watch/abc123')).toBe('facebook_reels');
  });

  it('does NOT detect facebook non-reel post as facebook_reels', () => {
    expect(detectPlatform('https://www.facebook.com/user/posts/123')).toBeNull();
  });

  it('does NOT detect facebook profile as facebook_reels', () => {
    expect(detectPlatform('https://www.facebook.com/someuser')).toBeNull();
  });

  it('detects facebook subdomain reel', () => {
    expect(detectPlatform('https://m.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  // Invalid / unknown
  it('returns null for invalid URL', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for instagram URL', () => {
    expect(detectPlatform('https://www.instagram.com/p/abc123/')).toBeNull();
  });

  it('returns null for twitter URL', () => {
    expect(detectPlatform('https://twitter.com/user/status/123')).toBeNull();
  });

  it('returns null for plain domain with no path', () => {
    expect(detectPlatform('https://www.google.com/')).toBeNull();
  });

  it('returns null for URLs that only contain "tiktok" in path but wrong domain', () => {
    expect(detectPlatform('https://www.example.com/tiktok/video')).toBeNull();
  });

  it('returns null for URLs that only contain "youtube" in path but wrong domain', () => {
    expect(detectPlatform('https://www.example.com/youtube/shorts/abc')).toBeNull();
  });

  it('handles url with no protocol as invalid', () => {
    expect(detectPlatform('tiktok.com/@user')).toBeNull();
  });
});

// ─── buildAccountProfileUrl ───────────────────────────────────────────────────

describe('buildAccountProfileUrl', () => {
  // YouTube
  it('builds youtube URL with @ handle', () => {
    expect(buildAccountProfileUrl('youtube', '@mychannel')).toBe('https://www.youtube.com/@mychannel');
  });

  it('builds youtube URL without @ prefix, adding it', () => {
    expect(buildAccountProfileUrl('youtube', 'mychannel')).toBe('https://www.youtube.com/@mychannel');
  });

  it('builds youtube URL for handle already prefixed with @', () => {
    expect(buildAccountProfileUrl('youtube', '@creator')).toBe('https://www.youtube.com/@creator');
  });

  // TikTok
  it('builds tiktok URL removing leading @', () => {
    expect(buildAccountProfileUrl('tiktok', '@myuser')).toBe('https://www.tiktok.com/@myuser');
  });

  it('builds tiktok URL adding @ when missing', () => {
    expect(buildAccountProfileUrl('tiktok', 'myuser')).toBe('https://www.tiktok.com/@myuser');
  });

  it('builds tiktok URL that does not double-add @', () => {
    const result = buildAccountProfileUrl('tiktok', '@creator');
    expect(result).toBe('https://www.tiktok.com/@creator');
    expect(result).not.toContain('@@');
  });

  // Instagram
  it('builds instagram URL removing leading @', () => {
    expect(buildAccountProfileUrl('instagram', '@myuser')).toBe('https://www.instagram.com/myuser/');
  });

  it('builds instagram URL with no leading @', () => {
    expect(buildAccountProfileUrl('instagram', 'myuser')).toBe('https://www.instagram.com/myuser/');
  });

  it('builds instagram URL with trailing slash', () => {
    const url = buildAccountProfileUrl('instagram', 'creator');
    expect(url.endsWith('/')).toBe(true);
  });

  it('instagram URL does not start with @', () => {
    const url = buildAccountProfileUrl('instagram', '@creator');
    expect(url).toContain('/creator/');
    expect(url).not.toContain('/@');
  });

  // Edge: handles with uppercase
  it('preserves casing for youtube handle', () => {
    expect(buildAccountProfileUrl('youtube', 'MyChannel')).toBe('https://www.youtube.com/@MyChannel');
  });

  it('preserves casing for tiktok handle', () => {
    expect(buildAccountProfileUrl('tiktok', 'MyUser')).toBe('https://www.tiktok.com/@MyUser');
  });

  it('preserves casing for instagram handle', () => {
    expect(buildAccountProfileUrl('instagram', 'MyUser')).toBe('https://www.instagram.com/MyUser/');
  });
});
