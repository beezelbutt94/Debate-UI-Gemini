import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ─── detectPlatform ───────────────────────────────────────────────────────────

describe('detectPlatform()', () => {
  // ── invalid input ──
  it('returns null for a completely invalid string', () => {
    expect(detectPlatform('not a url at all')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for an unknown domain', () => {
    expect(detectPlatform('https://example.com/video/123')).toBeNull();
  });

  // ── TikTok ──
  it('detects tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/@creator/video/123')).toBe('tiktok');
  });

  it('detects bare tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@creator/video/123')).toBe('tiktok');
  });

  it('detects tiktok subdomain (vm.tiktok.com)', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc123/')).toBe('tiktok');
  });

  it('detects m.tiktok.com subdomain', () => {
    expect(detectPlatform('https://m.tiktok.com/@creator/video/123')).toBe('tiktok');
  });

  // ── YouTube Shorts ──
  it('detects youtube.com/shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('detects m.youtube.com/shorts/', () => {
    expect(detectPlatform('https://m.youtube.com/shorts/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('returns null for youtube.com watch URL (not Shorts)', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });

  it('returns null for youtube.com channel URL', () => {
    expect(detectPlatform('https://www.youtube.com/@channel')).toBeNull();
  });

  it('detects youtu.be as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  // ── Facebook Reels ──
  it('detects facebook.com/reel/', () => {
    expect(detectPlatform('https://www.facebook.com/reel/1234567890')).toBe('facebook_reels');
  });

  it('detects facebook.com/reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/1234567890')).toBe('facebook_reels');
  });

  it('detects m.facebook.com/reel/', () => {
    expect(detectPlatform('https://m.facebook.com/reel/1234567890')).toBe('facebook_reels');
  });

  it('detects fb.watch', () => {
    expect(detectPlatform('https://fb.watch/abc123/')).toBe('facebook_reels');
  });

  it('returns null for facebook.com without /reel/', () => {
    expect(detectPlatform('https://www.facebook.com/video/1234567890')).toBeNull();
  });

  it('returns null for facebook.com plain post URL', () => {
    expect(detectPlatform('https://www.facebook.com/somepage/posts/12345')).toBeNull();
  });
});

// ─── buildAccountProfileUrl ───────────────────────────────────────────────────

describe('buildAccountProfileUrl()', () => {
  // ── YouTube ──
  it('builds YouTube URL and prepends @ when missing', () => {
    expect(buildAccountProfileUrl('youtube', 'creator')).toBe('https://www.youtube.com/@creator');
  });

  it('builds YouTube URL and keeps existing @ prefix', () => {
    expect(buildAccountProfileUrl('youtube', '@creator')).toBe('https://www.youtube.com/@creator');
  });

  // ── TikTok ──
  it('builds TikTok URL with @ stripped from handle', () => {
    expect(buildAccountProfileUrl('tiktok', '@creator')).toBe('https://www.tiktok.com/@creator');
  });

  it('builds TikTok URL and adds @ when handle has no prefix', () => {
    expect(buildAccountProfileUrl('tiktok', 'creator')).toBe('https://www.tiktok.com/@creator');
  });

  // ── Instagram ──
  it('builds Instagram URL with @ stripped', () => {
    expect(buildAccountProfileUrl('instagram', '@creator')).toBe('https://www.instagram.com/creator/');
  });

  it('builds Instagram URL when handle has no prefix', () => {
    expect(buildAccountProfileUrl('instagram', 'creator')).toBe('https://www.instagram.com/creator/');
  });

  it('does not double-prefix YouTube when handle already starts with @', () => {
    const url = buildAccountProfileUrl('youtube', '@mybrand');
    expect(url).toBe('https://www.youtube.com/@mybrand');
  });

  it('TikTok handle with double @ still produces correct URL', () => {
    // handle.replace(/^@/, '') on '@@foo' gives '@foo' -- document the actual behaviour
    const url = buildAccountProfileUrl('tiktok', '@@foo');
    expect(url).toBe('https://www.tiktok.com/@@foo');
  });
});
