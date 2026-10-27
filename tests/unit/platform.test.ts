import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ─── detectPlatform ───────────────────────────────────────────────────────────

describe('detectPlatform()', () => {
  // TikTok
  it('detects tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok subdomains', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc')).toBe('tiktok');
  });

  it('detects tiktok without path', () => {
    expect(detectPlatform('https://tiktok.com/')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com/shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/xyz')).toBe('youtube_shorts');
  });

  it('detects youtu.be short URLs', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('returns null for youtube.com without /shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('returns null for youtube.com channel pages', () => {
    expect(detectPlatform('https://www.youtube.com/@channel')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com/reel/', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects facebook.com/reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects fb.watch links', () => {
    expect(detectPlatform('https://fb.watch/abc123')).toBe('facebook_reels');
  });

  it('returns null for facebook.com without /reel/', () => {
    expect(detectPlatform('https://www.facebook.com/watch/?v=123')).toBeNull();
  });

  it('returns null for facebook.com posts (no reel)', () => {
    expect(detectPlatform('https://www.facebook.com/someuser/posts/123')).toBeNull();
  });

  // Invalid inputs
  it('returns null for a random URL', () => {
    expect(detectPlatform('https://example.com/video/123')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for non-URL garbage', () => {
    expect(detectPlatform('not a url at all')).toBeNull();
  });

  it('returns null for instagram.com (not a supported platform)', () => {
    expect(detectPlatform('https://www.instagram.com/p/abc/')).toBeNull();
  });

  it('returns null for twitter/X URL', () => {
    expect(detectPlatform('https://x.com/user/status/123')).toBeNull();
  });

  it('returns null for bare tiktok-like domain impostor', () => {
    // "faketiktok.com" should NOT match
    expect(detectPlatform('https://faketiktok.com/@user')).toBeNull();
  });

  it('returns null for domain ending in youtube.com impersonator', () => {
    // "notyoutube.com" should NOT match
    expect(detectPlatform('https://notyoutube.com/shorts/abc')).toBeNull();
  });

  it('detects m.tiktok.com as tiktok (subdomain)', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects m.facebook.com with reel', () => {
    expect(detectPlatform('https://m.facebook.com/reel/123')).toBe('facebook_reels');
  });
});

// ─── buildAccountProfileUrl ───────────────────────────────────────────────────

describe('buildAccountProfileUrl()', () => {
  // YouTube
  it('prepends @ for youtube handle without @', () => {
    expect(buildAccountProfileUrl('youtube', 'mychannel')).toBe('https://www.youtube.com/@mychannel');
  });

  it('does not double @ for youtube handle with @', () => {
    expect(buildAccountProfileUrl('youtube', '@mychannel')).toBe('https://www.youtube.com/@mychannel');
  });

  it('handles youtube handle with numbers', () => {
    expect(buildAccountProfileUrl('youtube', 'user123')).toBe('https://www.youtube.com/@user123');
  });

  // TikTok
  it('prepends @tiktok.com for handle without @', () => {
    expect(buildAccountProfileUrl('tiktok', 'creator')).toBe('https://www.tiktok.com/@creator');
  });

  it('does not double @ for tiktok handle with @', () => {
    expect(buildAccountProfileUrl('tiktok', '@creator')).toBe('https://www.tiktok.com/@creator');
  });

  it('handles tiktok handle with special chars', () => {
    expect(buildAccountProfileUrl('tiktok', 'user.name')).toBe('https://www.tiktok.com/@user.name');
  });

  // Instagram
  it('builds instagram url for handle without @', () => {
    expect(buildAccountProfileUrl('instagram', 'photopro')).toBe('https://www.instagram.com/photopro/');
  });

  it('strips @ for instagram handle with @', () => {
    expect(buildAccountProfileUrl('instagram', '@photopro')).toBe('https://www.instagram.com/photopro/');
  });

  it('handles instagram handle ending in slash (passthrough — no double slash expected)', () => {
    // The function only strips leading @, trailing slashes not present
    const url = buildAccountProfileUrl('instagram', 'user');
    expect(url).toBe('https://www.instagram.com/user/');
  });

  it('builds instagram url with numbers in handle', () => {
    expect(buildAccountProfileUrl('instagram', 'user_42')).toBe('https://www.instagram.com/user_42/');
  });

  // Edge: handle with multiple @ signs — function only removes leading one
  it('tiktok handle with only @ returns empty handle segment', () => {
    expect(buildAccountProfileUrl('tiktok', '@')).toBe('https://www.tiktok.com/@');
  });

  it('youtube handle with only @ keeps the @', () => {
    expect(buildAccountProfileUrl('youtube', '@')).toBe('https://www.youtube.com/@');
  });
});
