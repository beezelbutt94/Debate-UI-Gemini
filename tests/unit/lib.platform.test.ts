import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform()', () => {
  // --- TikTok ---
  it('detects plain tiktok.com URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/1234')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/1234')).toBe('tiktok');
  });

  it('detects tiktok subdomain (e.g. vm.tiktok.com)', () => {
    expect(detectPlatform('https://vm.tiktok.com/abcdef/')).toBe('tiktok');
  });

  it('detects tiktok with http scheme', () => {
    expect(detectPlatform('http://tiktok.com/@creator/video/999')).toBe('tiktok');
  });

  // --- YouTube Shorts ---
  it('detects youtube.com /shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com /shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtu.be short link', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('returns null for youtube.com watch (not /shorts/)', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('returns null for youtube.com channel URL', () => {
    expect(detectPlatform('https://www.youtube.com/@channel')).toBeNull();
  });

  // --- Facebook Reels ---
  it('detects facebook.com /reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/1234567890')).toBe('facebook_reels');
  });

  it('detects facebook.com /reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/1234567890')).toBe('facebook_reels');
  });

  it('detects fb.watch short link', () => {
    expect(detectPlatform('https://fb.watch/abcdef/')).toBe('facebook_reels');
  });

  it('returns null for facebook.com post that is not /reel/', () => {
    expect(detectPlatform('https://www.facebook.com/watch/?v=1234')).toBeNull();
  });

  it('returns null for facebook.com page URL', () => {
    expect(detectPlatform('https://www.facebook.com/SomePage')).toBeNull();
  });

  // --- Edge cases / invalid ---
  it('returns null for completely unrelated URL', () => {
    expect(detectPlatform('https://example.com/video')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for non-URL string', () => {
    expect(detectPlatform('not a url at all')).toBeNull();
  });

  it('returns null for instagram URL', () => {
    expect(detectPlatform('https://www.instagram.com/reel/abc123/')).toBeNull();
  });

  it('handles URL with query params and fragment', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/1234?lang=en#comments')).toBe('tiktok');
  });

  it('returns null for URL that looks like tiktok but is phishing domain', () => {
    expect(detectPlatform('https://evil-tiktok.com/video')).toBeNull();
  });
});

describe('buildAccountProfileUrl()', () => {
  // --- YouTube ---
  it('prepends @ to a bare YouTube handle', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('does not double-@ for YouTube handle already prefixed', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('works with lowercase youtube handle', () => {
    expect(buildAccountProfileUrl('youtube', 'creator')).toBe('https://www.youtube.com/@creator');
  });

  // --- TikTok ---
  it('builds TikTok URL stripping leading @', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('builds TikTok URL from bare handle', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('does not double-@ for TikTok', () => {
    const url = buildAccountProfileUrl('tiktok', '@user');
    expect(url).toBe('https://www.tiktok.com/@user');
  });

  // --- Instagram ---
  it('builds Instagram URL stripping leading @', () => {
    expect(buildAccountProfileUrl('instagram', '@therock')).toBe('https://www.instagram.com/therock/');
  });

  it('builds Instagram URL from bare handle', () => {
    expect(buildAccountProfileUrl('instagram', 'therock')).toBe('https://www.instagram.com/therock/');
  });

  it('does not double-@ for Instagram handle already prefixed', () => {
    expect(buildAccountProfileUrl('instagram', '@user')).toBe('https://www.instagram.com/user/');
  });

  it('handles handles with dots and underscores (Instagram)', () => {
    expect(buildAccountProfileUrl('instagram', 'my.brand_official')).toBe(
      'https://www.instagram.com/my.brand_official/',
    );
  });

  it('handles numeric-only YouTube handle', () => {
    expect(buildAccountProfileUrl('youtube', 'UC12345')).toBe('https://www.youtube.com/@UC12345');
  });
});
