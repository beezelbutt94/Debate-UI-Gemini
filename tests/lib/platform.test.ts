import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '../../lib/platform';

describe('detectPlatform', () => {
  // TikTok
  it('detects tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/@creator/video/123')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@creator/video/123')).toBe('tiktok');
  });

  it('detects tiktok subdomain', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc123/')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com/shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtu.be shortlink', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('does NOT detect youtube.com regular video as shorts', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com/reel/', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('detects facebook.com/reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('detects fb.watch shortlink', () => {
    expect(detectPlatform('https://fb.watch/abc123/')).toBe('facebook_reels');
  });

  it('does NOT detect facebook.com regular post', () => {
    expect(detectPlatform('https://www.facebook.com/user/posts/123')).toBeNull();
  });

  // Invalid
  it('returns null for invalid URL', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for unknown platform', () => {
    expect(detectPlatform('https://www.instagram.com/reel/abc123/')).toBeNull();
  });

  it('returns null for twitter', () => {
    expect(detectPlatform('https://twitter.com/user/status/123')).toBeNull();
  });

  it('returns null for a non-shorts YouTube URL', () => {
    expect(detectPlatform('https://www.youtube.com/channel/abc')).toBeNull();
  });

  // Facebook subdomain (e.g. m.facebook.com)
  it('detects m.facebook.com reel', () => {
    expect(detectPlatform('https://m.facebook.com/reel/123456789')).toBe('facebook_reels');
  });
});

describe('buildAccountProfileUrl', () => {
  // YouTube
  it('adds @ prefix to youtube handle when missing', () => {
    expect(buildAccountProfileUrl('youtube', 'creator')).toBe('https://www.youtube.com/@creator');
  });

  it('keeps @ prefix on youtube handle', () => {
    expect(buildAccountProfileUrl('youtube', '@creator')).toBe('https://www.youtube.com/@creator');
  });

  // TikTok
  it('adds @ prefix to tiktok handle when missing', () => {
    expect(buildAccountProfileUrl('tiktok', 'creator')).toBe('https://www.tiktok.com/@creator');
  });

  it('removes extra @ from tiktok handle', () => {
    expect(buildAccountProfileUrl('tiktok', '@creator')).toBe('https://www.tiktok.com/@creator');
  });

  // Instagram
  it('adds trailing slash to instagram url', () => {
    expect(buildAccountProfileUrl('instagram', 'creator')).toBe('https://www.instagram.com/creator/');
  });

  it('removes @ prefix from instagram handle', () => {
    expect(buildAccountProfileUrl('instagram', '@creator')).toBe('https://www.instagram.com/creator/');
  });

  it('handles instagram handle with no @', () => {
    expect(buildAccountProfileUrl('instagram', 'my_brand')).toBe('https://www.instagram.com/my_brand/');
  });

  it('handles youtube handle with special chars', () => {
    expect(buildAccountProfileUrl('youtube', 'my.channel_123')).toBe('https://www.youtube.com/@my.channel_123');
  });

  it('handles tiktok handle with underscores', () => {
    expect(buildAccountProfileUrl('tiktok', 'cool_creator_99')).toBe('https://www.tiktok.com/@cool_creator_99');
  });
});
