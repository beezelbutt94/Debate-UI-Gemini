import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ─── detectPlatform ──────────────────────────────────────────────────────────

describe('detectPlatform', () => {
  // TikTok
  it('detects tiktok.com video URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123456789')).toBe('tiktok');
  });

  it('detects bare tiktok.com (no www)', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/1')).toBe('tiktok');
  });

  it('detects m.tiktok.com (subdomain)', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/1')).toBe('tiktok');
  });

  it('detects vm.tiktok.com short link (subdomain)', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc123')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com/shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc')).toBe('youtube_shorts');
  });

  it('detects youtu.be short link as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('returns null for youtube.com without /shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });

  it('returns null for youtube.com channel URL', () => {
    expect(detectPlatform('https://www.youtube.com/@SomeChannel')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com/reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects facebook.com/reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/99')).toBe('facebook_reels');
  });

  it('detects fb.watch short link as facebook_reels', () => {
    expect(detectPlatform('https://fb.watch/abc123')).toBe('facebook_reels');
  });

  it('returns null for facebook.com without /reel/', () => {
    expect(detectPlatform('https://www.facebook.com/someuser/videos/123')).toBeNull();
  });

  // Invalid / unrecognised
  it('returns null for a completely unrelated URL', () => {
    expect(detectPlatform('https://example.com/video/123')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a non-URL string', () => {
    expect(detectPlatform('not a url')).toBeNull();
  });

  it('returns null for a bare domain without protocol', () => {
    expect(detectPlatform('tiktok.com/@user/video/1')).toBeNull();
  });

  it('returns null for a twitter URL', () => {
    expect(detectPlatform('https://twitter.com/user/status/123')).toBeNull();
  });

  it('returns null for an instagram URL', () => {
    expect(detectPlatform('https://www.instagram.com/reel/abc123')).toBeNull();
  });

  it('handles URLs with query strings (TikTok)', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123?is_from_webapp=1')).toBe('tiktok');
  });

  it('handles URLs with query strings (YouTube Shorts)', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc?feature=share')).toBe('youtube_shorts');
  });

  it('handles URLs with query strings (Facebook Reel)', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123?s=09')).toBe('facebook_reels');
  });
});

// ─── buildAccountProfileUrl ──────────────────────────────────────────────────

describe('buildAccountProfileUrl', () => {
  // YouTube
  it('builds youtube URL for handle with @ prefix', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('builds youtube URL for handle without @ prefix (adds @)', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('builds youtube URL and does not double the @', () => {
    expect(buildAccountProfileUrl('youtube', '@Channel')).toBe('https://www.youtube.com/@Channel');
  });

  // TikTok
  it('builds tiktok URL for handle with @ prefix (strips leading @)', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('builds tiktok URL for handle without @ prefix', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('builds tiktok URL and does not double the @', () => {
    expect(buildAccountProfileUrl('tiktok', '@user')).toBe('https://www.tiktok.com/@user');
  });

  // Instagram
  it('builds instagram URL for handle with @ prefix (strips leading @)', () => {
    expect(buildAccountProfileUrl('instagram', '@natgeo')).toBe('https://www.instagram.com/natgeo/');
  });

  it('builds instagram URL for handle without @ prefix', () => {
    expect(buildAccountProfileUrl('instagram', 'natgeo')).toBe('https://www.instagram.com/natgeo/');
  });

  it('builds instagram URL with trailing slash', () => {
    const url = buildAccountProfileUrl('instagram', 'user');
    expect(url.endsWith('/')).toBe(true);
  });

  it('youtube URL starts with https://www.youtube.com/', () => {
    const url = buildAccountProfileUrl('youtube', 'test');
    expect(url.startsWith('https://www.youtube.com/')).toBe(true);
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
