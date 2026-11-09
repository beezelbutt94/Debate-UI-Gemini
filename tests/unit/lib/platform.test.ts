import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform()', () => {
  // TikTok
  it('detects tiktok.com URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects bare tiktok.com (no www)', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects mobile m.tiktok.com', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects any tiktok.com subdomain', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc123')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com/shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('returns null for youtube.com/watch URL (not a Short)', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('detects youtu.be short link as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  // Facebook Reels
  it('detects facebook.com/reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects facebook.com/reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects fb.watch short URL', () => {
    expect(detectPlatform('https://fb.watch/abc123')).toBe('facebook_reels');
  });

  it('returns null for facebook.com with no /reel/ path', () => {
    expect(detectPlatform('https://www.facebook.com/someuser/posts/123')).toBeNull();
  });

  // Unknown platforms
  it('returns null for a google.com URL', () => {
    expect(detectPlatform('https://www.google.com')).toBeNull();
  });

  it('returns null for an instagram URL', () => {
    expect(detectPlatform('https://www.instagram.com/p/abc123')).toBeNull();
  });

  it('returns null for a twitter/x URL', () => {
    expect(detectPlatform('https://twitter.com/user/status/123')).toBeNull();
  });

  // Invalid inputs
  it('returns null for an invalid/non-URL string', () => {
    expect(detectPlatform('not a url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a bare domain with no scheme', () => {
    expect(detectPlatform('tiktok.com/@user')).toBeNull();
  });
});

describe('buildAccountProfileUrl()', () => {
  // YouTube
  it('prefixes @ for a bare YouTube handle', () => {
    expect(buildAccountProfileUrl('youtube', 'mkbhd')).toBe('https://www.youtube.com/@mkbhd');
  });

  it('keeps the leading @ for a YouTube handle that already has it', () => {
    expect(buildAccountProfileUrl('youtube', '@mkbhd')).toBe('https://www.youtube.com/@mkbhd');
  });

  it('handles YouTube handle with uppercase', () => {
    const url = buildAccountProfileUrl('youtube', 'MrBeast');
    expect(url).toBe('https://www.youtube.com/@MrBeast');
  });

  // TikTok
  it('prefixes @ for a bare TikTok handle', () => {
    expect(buildAccountProfileUrl('tiktok', 'username')).toBe('https://www.tiktok.com/@username');
  });

  it('strips leading @ before re-adding it for TikTok', () => {
    expect(buildAccountProfileUrl('tiktok', '@username')).toBe('https://www.tiktok.com/@username');
  });

  it('handles double-@ for TikTok (strips only first)', () => {
    // @@user → replaces first @ → @user
    expect(buildAccountProfileUrl('tiktok', '@@user')).toBe('https://www.tiktok.com/@@user');
  });

  // Instagram
  it('strips @ for an Instagram handle that starts with it', () => {
    expect(buildAccountProfileUrl('instagram', '@username')).toBe('https://www.instagram.com/username/');
  });

  it('keeps bare handle for Instagram', () => {
    expect(buildAccountProfileUrl('instagram', 'username')).toBe('https://www.instagram.com/username/');
  });

  it('appends trailing slash for Instagram', () => {
    const url = buildAccountProfileUrl('instagram', 'creator');
    expect(url.endsWith('/')).toBe(true);
  });
});
