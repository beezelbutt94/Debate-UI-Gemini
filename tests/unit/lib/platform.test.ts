import { describe, it, expect } from 'vitest';
import { detectPlatform } from '@/lib/platform';
import { buildAccountProfileUrl } from '@/lib/platform';

// ── detectPlatform ────────────────────────────────────────────────────────────

describe('detectPlatform', () => {
  // TikTok
  it('detects tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/@creator/video/123')).toBe('tiktok');
  });

  it('detects tiktok without www', () => {
    expect(detectPlatform('https://tiktok.com/@creator/video/123')).toBe('tiktok');
  });

  it('detects tiktok subdomain', () => {
    expect(detectPlatform('https://m.tiktok.com/@creator/video/123')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com /shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com /shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtu.be short link', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('does NOT detect regular youtube.com watch URL as youtube_shorts', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
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

  it('detects facebook subdomain /reel/', () => {
    expect(detectPlatform('https://m.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('does NOT detect facebook.com non-reel URL', () => {
    expect(detectPlatform('https://www.facebook.com/groups/somegroup')).toBeNull();
  });

  // Unknown / invalid
  it('returns null for instagram', () => {
    expect(detectPlatform('https://www.instagram.com/p/abc/')).toBeNull();
  });

  it('returns null for twitter/X', () => {
    expect(detectPlatform('https://x.com/user/status/123')).toBeNull();
  });

  it('returns null for an invalid URL string', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for bare domain with no path', () => {
    expect(detectPlatform('https://example.com')).toBeNull();
  });

  it('returns null for vimeo', () => {
    expect(detectPlatform('https://vimeo.com/123456')).toBeNull();
  });
});

// ── buildAccountProfileUrl ────────────────────────────────────────────────────

describe('buildAccountProfileUrl', () => {
  // YouTube
  it('builds youtube URL with bare handle (no @)', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('builds youtube URL with @ handle (no double @)', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  // TikTok
  it('builds tiktok URL with bare handle', () => {
    expect(buildAccountProfileUrl('tiktok', 'creator')).toBe('https://www.tiktok.com/@creator');
  });

  it('builds tiktok URL stripping leading @', () => {
    expect(buildAccountProfileUrl('tiktok', '@creator')).toBe('https://www.tiktok.com/@creator');
  });

  // Instagram
  it('builds instagram URL with bare handle', () => {
    expect(buildAccountProfileUrl('instagram', 'creator')).toBe('https://www.instagram.com/creator/');
  });

  it('builds instagram URL stripping leading @', () => {
    expect(buildAccountProfileUrl('instagram', '@creator')).toBe('https://www.instagram.com/creator/');
  });

  it('handles handles with mixed case', () => {
    expect(buildAccountProfileUrl('youtube', 'SomeCreator')).toBe('https://www.youtube.com/@SomeCreator');
  });

  it('handles handles with underscores', () => {
    expect(buildAccountProfileUrl('tiktok', 'some_creator')).toBe('https://www.tiktok.com/@some_creator');
  });

  it('handles handles with dots', () => {
    expect(buildAccountProfileUrl('instagram', 'some.creator')).toBe('https://www.instagram.com/some.creator/');
  });
});
