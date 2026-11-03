import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform()', () => {
  // TikTok
  it('detects tiktok.com URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@someuser/video/12345')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/99')).toBe('tiktok');
  });

  it('detects tiktok subdomain (vm.tiktok.com)', () => {
    expect(detectPlatform('https://vm.tiktok.com/abcdef')).toBe('tiktok');
  });

  it('detects m.tiktok.com subdomain', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/12345')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com/shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abcXYZ123')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/vid123')).toBe('youtube_shorts');
  });

  it('detects youtu.be short link', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('does NOT detect regular youtube.com watch URL as shorts', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('does NOT detect youtube.com channel page as shorts', () => {
    expect(detectPlatform('https://www.youtube.com/@MrBeast')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com/reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/12345678')).toBe('facebook_reels');
  });

  it('detects facebook.com/reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/99999')).toBe('facebook_reels');
  });

  it('detects fb.watch short link', () => {
    expect(detectPlatform('https://fb.watch/abc123/')).toBe('facebook_reels');
  });

  it('detects m.facebook.com/reel/ subdomain', () => {
    expect(detectPlatform('https://m.facebook.com/reel/12345')).toBe('facebook_reels');
  });

  it('does NOT detect facebook.com non-reel URL', () => {
    expect(detectPlatform('https://www.facebook.com/someuser/posts/12345')).toBeNull();
  });

  // Edge cases / null returns
  it('returns null for an invalid URL string', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for an unrelated URL (twitter.com)', () => {
    expect(detectPlatform('https://twitter.com/user/status/123')).toBeNull();
  });

  it('returns null for instagram.com', () => {
    expect(detectPlatform('https://www.instagram.com/p/abc123/')).toBeNull();
  });

  it('returns null for vimeo', () => {
    expect(detectPlatform('https://vimeo.com/123456789')).toBeNull();
  });

  it('handles URL with query string for shorts', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc?feature=share')).toBe('youtube_shorts');
  });
});

describe('buildAccountProfileUrl()', () => {
  // YouTube
  it('builds youtube URL for handle without @', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('builds youtube URL for handle with @', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('builds youtube URL for handle with @ already present (no double @)', () => {
    const url = buildAccountProfileUrl('youtube', '@creator');
    expect(url).toBe('https://www.youtube.com/@creator');
    expect(url).not.toContain('@@');
  });

  // TikTok
  it('builds tiktok URL for handle without @', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('builds tiktok URL for handle with @', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('builds tiktok URL stripping leading @ (no double @)', () => {
    const url = buildAccountProfileUrl('tiktok', '@user');
    expect(url).not.toContain('@@');
    expect(url).toBe('https://www.tiktok.com/@user');
  });

  // Instagram
  it('builds instagram URL for handle without @', () => {
    expect(buildAccountProfileUrl('instagram', 'natgeo')).toBe('https://www.instagram.com/natgeo/');
  });

  it('builds instagram URL for handle with @ stripped', () => {
    expect(buildAccountProfileUrl('instagram', '@natgeo')).toBe('https://www.instagram.com/natgeo/');
  });

  it('instagram URL ends with trailing slash', () => {
    const url = buildAccountProfileUrl('instagram', 'user');
    expect(url.endsWith('/')).toBe(true);
  });

  it('youtube URL starts with correct base', () => {
    const url = buildAccountProfileUrl('youtube', 'test');
    expect(url.startsWith('https://www.youtube.com/')).toBe(true);
  });

  it('tiktok URL starts with correct base', () => {
    const url = buildAccountProfileUrl('tiktok', 'test');
    expect(url.startsWith('https://www.tiktok.com/')).toBe(true);
  });

  it('instagram URL starts with correct base', () => {
    const url = buildAccountProfileUrl('instagram', 'test');
    expect(url.startsWith('https://www.instagram.com/')).toBe(true);
  });
});
