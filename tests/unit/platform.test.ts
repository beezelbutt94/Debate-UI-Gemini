import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform', () => {
  // TikTok
  it('detects tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/@username/video/1234567890')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@username/video/1234567890')).toBe('tiktok');
  });

  it('detects tiktok short link subdomain (vm.tiktok.com)', () => {
    expect(detectPlatform('https://vm.tiktok.com/ZMe1234/')).toBe('tiktok');
  });

  it('detects m.tiktok.com', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/999')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com/shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtu.be short link', () => {
    expect(detectPlatform('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('returns null for youtube.com/watch (not a short)', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });

  it('returns null for youtube.com channel URL', () => {
    expect(detectPlatform('https://www.youtube.com/@channelname')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com/reel/', () => {
    expect(detectPlatform('https://www.facebook.com/reel/1234567890')).toBe('facebook_reels');
  });

  it('detects facebook.com/reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/abc123')).toBe('facebook_reels');
  });

  it('detects fb.watch', () => {
    expect(detectPlatform('https://fb.watch/abcXYZ123/')).toBe('facebook_reels');
  });

  it('returns null for facebook.com non-reel', () => {
    expect(detectPlatform('https://www.facebook.com/groups/12345')).toBeNull();
  });

  it('returns null for facebook.com post (no /reel/)', () => {
    expect(detectPlatform('https://www.facebook.com/username/posts/123456')).toBeNull();
  });

  // Invalid inputs
  it('returns null for a bare string (not a URL)', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for an unrecognised platform', () => {
    expect(detectPlatform('https://www.instagram.com/p/abc123/')).toBeNull();
  });

  it('returns null for twitter/x', () => {
    expect(detectPlatform('https://twitter.com/i/status/123456')).toBeNull();
  });

  it('returns null for a bare IP address', () => {
    expect(detectPlatform('http://192.168.1.1/video')).toBeNull();
  });
});

describe('buildAccountProfileUrl', () => {
  // YouTube
  it('builds YouTube URL with @-prefixed handle', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('builds YouTube URL with handle without @', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('does not double the @ for YouTube', () => {
    const url = buildAccountProfileUrl('youtube', '@creator');
    expect(url).toBe('https://www.youtube.com/@creator');
    expect(url).not.toContain('@@');
  });

  // TikTok
  it('builds TikTok URL stripping the leading @', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('builds TikTok URL adding @ when missing', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('does not double the @ for TikTok', () => {
    const url = buildAccountProfileUrl('tiktok', '@user123');
    expect(url).not.toContain('@@');
  });

  // Instagram
  it('builds Instagram URL stripping leading @', () => {
    expect(buildAccountProfileUrl('instagram', '@cristiano')).toBe('https://www.instagram.com/cristiano/');
  });

  it('builds Instagram URL when no leading @', () => {
    expect(buildAccountProfileUrl('instagram', 'cristiano')).toBe('https://www.instagram.com/cristiano/');
  });

  it('does not double the @ for Instagram', () => {
    const url = buildAccountProfileUrl('instagram', '@gram_user');
    expect(url).not.toContain('@');
  });

  it('Instagram URL ends with /', () => {
    const url = buildAccountProfileUrl('instagram', 'someone');
    expect(url.endsWith('/')).toBe(true);
  });
});
