import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ---------------------------------------------------------------------------
// detectPlatform
// ---------------------------------------------------------------------------

describe('detectPlatform', () => {
  // TikTok
  it('detects tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/@creator/video/123')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@creator/video/123')).toBe('tiktok');
  });

  it('detects tiktok subdomain (vm.tiktok.com)', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc123/')).toBe('tiktok');
  });

  // YouTube Shorts via /shorts/ path
  it('detects youtube.com /shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com /shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com subdomain with /shorts/', () => {
    expect(detectPlatform('https://m.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  // youtu.be (always treated as a short)
  it('detects youtu.be URL', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  // YouTube without /shorts/ → not a short-form video
  it('returns null for youtube.com without /shorts/ path', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('returns null for youtube.com channel URL', () => {
    expect(detectPlatform('https://www.youtube.com/@channel')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com /reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects facebook.com /reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects facebook.com subdomain with /reel/', () => {
    expect(detectPlatform('https://m.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects fb.watch URL (always treated as reel)', () => {
    expect(detectPlatform('https://fb.watch/abc/')).toBe('facebook_reels');
  });

  // Facebook without /reel/ → null
  it('returns null for a plain facebook.com page', () => {
    expect(detectPlatform('https://www.facebook.com/pages/something/123')).toBeNull();
  });

  // Unknown domains
  it('returns null for an unknown domain', () => {
    expect(detectPlatform('https://www.instagram.com/p/abc123')).toBeNull();
  });

  it('returns null for a random URL', () => {
    expect(detectPlatform('https://example.com/video/123')).toBeNull();
  });

  // Invalid / malformed input
  it('returns null for a non-URL string', () => {
    expect(detectPlatform('not a url')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a bare domain with no scheme', () => {
    expect(detectPlatform('tiktok.com/@creator/video/123')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildAccountProfileUrl
// ---------------------------------------------------------------------------

describe('buildAccountProfileUrl', () => {
  // YouTube
  it('prefixes @ for a bare YouTube handle', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('does not double-prefix @ for a YouTube handle that already starts with @', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  // TikTok
  it('strips leading @ before inserting it for TikTok', () => {
    expect(buildAccountProfileUrl('tiktok', '@creator')).toBe('https://www.tiktok.com/@creator');
  });

  it('adds @ for a bare TikTok handle', () => {
    expect(buildAccountProfileUrl('tiktok', 'creator')).toBe('https://www.tiktok.com/@creator');
  });

  // Instagram
  it('strips leading @ before inserting it for Instagram', () => {
    expect(buildAccountProfileUrl('instagram', '@influencer')).toBe('https://www.instagram.com/influencer/');
  });

  it('adds no @ and appends trailing slash for Instagram', () => {
    expect(buildAccountProfileUrl('instagram', 'influencer')).toBe('https://www.instagram.com/influencer/');
  });

  it('handles numeric TikTok handles', () => {
    expect(buildAccountProfileUrl('tiktok', '12345')).toBe('https://www.tiktok.com/@12345');
  });

  it('handles numeric YouTube handles', () => {
    expect(buildAccountProfileUrl('youtube', '12345')).toBe('https://www.youtube.com/@12345');
  });

  it('handles mixed-case handles without altering case', () => {
    expect(buildAccountProfileUrl('youtube', 'CamelCase')).toBe('https://www.youtube.com/@CamelCase');
  });
});
