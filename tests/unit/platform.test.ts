import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform', () => {
  // TikTok
  it('detects tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok without www', () => {
    expect(detectPlatform('https://tiktok.com/@user')).toBe('tiktok');
  });

  it('detects tiktok subdomain', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc123')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com /shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/xyz')).toBe('youtube_shorts');
  });

  it('detects youtu.be short link', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('does NOT detect youtube.com without /shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('does NOT detect youtube.com/channel', () => {
    expect(detectPlatform('https://www.youtube.com/channel/UCabc')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com /reel/', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects facebook.com /reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects fb.watch', () => {
    expect(detectPlatform('https://fb.watch/abc123')).toBe('facebook_reels');
  });

  it('does NOT detect facebook.com without /reel/', () => {
    expect(detectPlatform('https://www.facebook.com/someuser/posts/123')).toBeNull();
  });

  // Edge cases
  it('returns null for invalid URL', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for unrecognized domain', () => {
    expect(detectPlatform('https://www.instagram.com/p/abc/')).toBeNull();
  });

  it('returns null for twitter/x', () => {
    expect(detectPlatform('https://x.com/user/status/123')).toBeNull();
  });

  it('detects m.youtube.com/shorts/ (mobile subdomain)', () => {
    expect(detectPlatform('https://m.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects m.facebook.com/reel/ (mobile subdomain)', () => {
    expect(detectPlatform('https://m.facebook.com/reel/999')).toBe('facebook_reels');
  });

  it('does NOT detect /shorts/ in a non-youtube domain', () => {
    expect(detectPlatform('https://example.com/shorts/abc')).toBeNull();
  });

  it('does NOT detect /reel/ in a non-facebook domain', () => {
    expect(detectPlatform('https://example.com/reel/abc')).toBeNull();
  });

  it('youtube.com without /shorts/ and with query params is null', () => {
    expect(detectPlatform('https://www.youtube.com/watch?shorts=abc')).toBeNull();
  });

  it('tiktok.com with deep path is still tiktok', () => {
    expect(detectPlatform('https://www.tiktok.com/@creator/video/123456789?lang=en')).toBe('tiktok');
  });

  it('ftp:// scheme with unknown domain returns null', () => {
    // detectPlatform checks hostname and path only, not scheme
    expect(detectPlatform('ftp://example.com/path')).toBeNull();
  });

  it('ftp:// scheme with tiktok.com is still detected as tiktok', () => {
    // The function does not restrict by HTTP/HTTPS — hostname match is what counts
    expect(detectPlatform('ftp://tiktok.com/@user')).toBe('tiktok');
  });

  it('URL with only a trailing slash is handled', () => {
    expect(detectPlatform('https://tiktok.com/')).toBe('tiktok');
  });
});

describe('buildAccountProfileUrl', () => {
  // YouTube
  it('builds youtube url with @ handle', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('builds youtube url without leading @ (adds it)', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  // TikTok
  it('builds tiktok url with @ handle (strips @)', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('builds tiktok url without @ handle', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  // Instagram
  it('builds instagram url with @ handle (strips @)', () => {
    expect(buildAccountProfileUrl('instagram', '@someuser')).toBe('https://www.instagram.com/someuser/');
  });

  it('builds instagram url without @ handle', () => {
    expect(buildAccountProfileUrl('instagram', 'someuser')).toBe('https://www.instagram.com/someuser/');
  });

  it('youtube double @ not doubled', () => {
    // handle already has @, should not produce @@
    expect(buildAccountProfileUrl('youtube', '@@user')).toBe('https://www.youtube.com/@@user');
    // Note: the implementation only strips one leading @, so @@user stays as-is for youtube
    // The implementation: handle.startsWith('@') ? handle : `@${handle}`
    // @@user starts with @, so it stays as @@user
  });

  it('tiktok strips @ before prepending it back', () => {
    // @@user → strip one @ → @user → prepend @ → @@user? No:
    // handle.replace(/^@/, '') strips exactly one leading @
    expect(buildAccountProfileUrl('tiktok', '@@user')).toBe('https://www.tiktok.com/@@user');
  });

  it('instagram strips @ correctly', () => {
    expect(buildAccountProfileUrl('instagram', '@creator')).toBe('https://www.instagram.com/creator/');
    expect(buildAccountProfileUrl('instagram', 'creator')).toBe('https://www.instagram.com/creator/');
  });

  it('youtube returns HTTPS URL', () => {
    const url = buildAccountProfileUrl('youtube', 'test');
    expect(url.startsWith('https://')).toBe(true);
  });

  it('tiktok returns HTTPS URL', () => {
    const url = buildAccountProfileUrl('tiktok', 'test');
    expect(url.startsWith('https://')).toBe(true);
  });

  it('instagram returns HTTPS URL with trailing slash', () => {
    const url = buildAccountProfileUrl('instagram', 'test');
    expect(url.startsWith('https://')).toBe(true);
    expect(url.endsWith('/')).toBe(true);
  });
});
