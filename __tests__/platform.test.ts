import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform()', () => {
  // --- TikTok ---
  it('detects tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/@creator/video/123')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@creator/video/123')).toBe('tiktok');
  });

  it('detects a tiktok subdomain', () => {
    expect(detectPlatform('https://vm.tiktok.com/ZMhXXXXX/')).toBe('tiktok');
  });

  // --- YouTube Shorts ---
  it('detects youtube.com /shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com /shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtu.be short links as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('does NOT detect youtube.com without /shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('does NOT detect youtube.com channel pages', () => {
    expect(detectPlatform('https://www.youtube.com/@creator')).toBeNull();
  });

  // --- Facebook Reels ---
  it('detects facebook.com /reel/', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects fb.watch', () => {
    expect(detectPlatform('https://fb.watch/abcXYZ/')).toBe('facebook_reels');
  });

  it('detects facebook.com /reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects facebook subdomain /reel/', () => {
    expect(detectPlatform('https://m.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('does NOT detect facebook.com without /reel/', () => {
    expect(detectPlatform('https://www.facebook.com/creator/posts/123')).toBeNull();
  });

  // --- Invalid ---
  it('returns null for a non-video URL', () => {
    expect(detectPlatform('https://www.google.com')).toBeNull();
  });

  it('returns null for an invalid URL string', () => {
    expect(detectPlatform('not a url')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a vimeo URL', () => {
    expect(detectPlatform('https://vimeo.com/123456')).toBeNull();
  });

  it('does not match a URL that merely contains "tiktok" in the path on another domain', () => {
    expect(detectPlatform('https://example.com/tiktok/video')).toBeNull();
  });

  // --- Path-vs-querystring boundary (regression for rawUrl.includes bug) ---
  it('does NOT detect youtube_shorts when /shorts/ appears only in query string', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc&redirect=/shorts/')).toBeNull();
  });

  it('does NOT detect facebook_reels when /reel/ appears only in query string', () => {
    expect(detectPlatform('https://www.facebook.com/creator?share=/reel/123')).toBeNull();
  });

  it('detects youtube_shorts when URL has /shorts/ in path AND query params', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123?si=xyz')).toBe('youtube_shorts');
  });

  it('detects facebook_reels when URL has /reel/ in path AND query params', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456?mibextid=abc')).toBe('facebook_reels');
  });

  it('detects tiktok with query parameters (share tracking)', () => {
    expect(detectPlatform('https://www.tiktok.com/@creator/video/123?utm_source=share')).toBe('tiktok');
  });
});

describe('buildAccountProfileUrl()', () => {
  // --- youtube ---
  it('builds a youtube URL with a bare handle (adds @)', () => {
    expect(buildAccountProfileUrl('youtube', 'creator')).toBe('https://www.youtube.com/@creator');
  });

  it('builds a youtube URL with an @ handle (does not double @)', () => {
    expect(buildAccountProfileUrl('youtube', '@creator')).toBe('https://www.youtube.com/@creator');
  });

  // --- tiktok ---
  it('builds a tiktok URL with a bare handle (adds @)', () => {
    expect(buildAccountProfileUrl('tiktok', 'creator')).toBe('https://www.tiktok.com/@creator');
  });

  it('builds a tiktok URL stripping a leading @', () => {
    expect(buildAccountProfileUrl('tiktok', '@creator')).toBe('https://www.tiktok.com/@creator');
  });

  // --- instagram ---
  it('builds an instagram URL with a bare handle', () => {
    expect(buildAccountProfileUrl('instagram', 'creator')).toBe('https://www.instagram.com/creator/');
  });

  it('builds an instagram URL stripping a leading @', () => {
    expect(buildAccountProfileUrl('instagram', '@creator')).toBe('https://www.instagram.com/creator/');
  });

  it('handles handles with numbers and underscores', () => {
    expect(buildAccountProfileUrl('tiktok', 'creator_99')).toBe('https://www.tiktok.com/@creator_99');
  });
});
