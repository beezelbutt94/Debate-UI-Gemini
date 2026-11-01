import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform', () => {
  // --- TikTok ---
  it('detects bare tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok subdomain (m.tiktok.com)', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects v.tiktok.com subdomain', () => {
    expect(detectPlatform('https://v.tiktok.com/some-path')).toBe('tiktok');
  });

  // --- YouTube Shorts ---
  it('detects youtube.com/shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects m.youtube.com/shorts/', () => {
    expect(detectPlatform('https://m.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtu.be short links', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('returns null for youtube.com/watch (not a Short)', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('returns null for youtube.com channel page', () => {
    expect(detectPlatform('https://www.youtube.com/@Channel')).toBeNull();
  });

  // --- Facebook Reels ---
  it('detects facebook.com/reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects facebook.com/reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects m.facebook.com/reel/ subdomain', () => {
    expect(detectPlatform('https://m.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects fb.watch short link', () => {
    expect(detectPlatform('https://fb.watch/abcdef/')).toBe('facebook_reels');
  });

  it('returns null for facebook.com without /reel/', () => {
    expect(detectPlatform('https://www.facebook.com/groups/something')).toBeNull();
  });

  // --- Invalid / Unknown ---
  it('returns null for non-video URL', () => {
    expect(detectPlatform('https://example.com/video/123')).toBeNull();
  });

  it('returns null for completely invalid URL', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for twitter/X URL', () => {
    expect(detectPlatform('https://twitter.com/user/status/123')).toBeNull();
  });

  it('returns null for instagram URL', () => {
    expect(detectPlatform('https://www.instagram.com/reel/abc123/')).toBeNull();
  });

  it('handles URLs with query parameters (TikTok)', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123?is_from_webapp=1')).toBe('tiktok');
  });

  it('handles URLs with query parameters (YouTube Shorts)', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123?si=token')).toBe('youtube_shorts');
  });

  it('handles URLs with query parameters (Facebook Reel)', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456?mibextid=reel')).toBe('facebook_reels');
  });
});

describe('buildAccountProfileUrl', () => {
  // --- YouTube ---
  it('adds @ prefix for youtube handle without @', () => {
    expect(buildAccountProfileUrl('youtube', 'MyChannel')).toBe('https://www.youtube.com/@MyChannel');
  });

  it('does not double-add @ prefix for youtube', () => {
    expect(buildAccountProfileUrl('youtube', '@MyChannel')).toBe('https://www.youtube.com/@MyChannel');
  });

  it('handles youtube handle with numbers', () => {
    expect(buildAccountProfileUrl('youtube', 'Channel123')).toBe('https://www.youtube.com/@Channel123');
  });

  // --- TikTok ---
  it('strips @ prefix for tiktok and reconstructs', () => {
    expect(buildAccountProfileUrl('tiktok', '@myhandle')).toBe('https://www.tiktok.com/@myhandle');
  });

  it('adds @ for tiktok handle without @', () => {
    expect(buildAccountProfileUrl('tiktok', 'myhandle')).toBe('https://www.tiktok.com/@myhandle');
  });

  it('handles tiktok handle with underscores', () => {
    expect(buildAccountProfileUrl('tiktok', 'my_handle_123')).toBe('https://www.tiktok.com/@my_handle_123');
  });

  // --- Instagram ---
  it('strips @ prefix for instagram handle', () => {
    expect(buildAccountProfileUrl('instagram', '@photo_user')).toBe('https://www.instagram.com/photo_user/');
  });

  it('adds no extra @ for instagram handle without @', () => {
    expect(buildAccountProfileUrl('instagram', 'photo_user')).toBe('https://www.instagram.com/photo_user/');
  });

  it('handles instagram handle with dots', () => {
    expect(buildAccountProfileUrl('instagram', 'my.user.name')).toBe('https://www.instagram.com/my.user.name/');
  });

  it('trailing slash is present for instagram URLs', () => {
    const url = buildAccountProfileUrl('instagram', 'user');
    expect(url.endsWith('/')).toBe(true);
  });

  it('youtube URL starts with https://www.youtube.com/@', () => {
    const url = buildAccountProfileUrl('youtube', 'test');
    expect(url.startsWith('https://www.youtube.com/@')).toBe(true);
  });

  it('tiktok URL starts with https://www.tiktok.com/@', () => {
    const url = buildAccountProfileUrl('tiktok', 'test');
    expect(url.startsWith('https://www.tiktok.com/@')).toBe(true);
  });

  it('instagram URL starts with https://www.instagram.com/', () => {
    const url = buildAccountProfileUrl('instagram', 'test');
    expect(url.startsWith('https://www.instagram.com/')).toBe(true);
  });
});
