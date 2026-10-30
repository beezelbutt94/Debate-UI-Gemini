import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ──────────────────────────────────────────────────────────
// detectPlatform()
// ──────────────────────────────────────────────────────────
describe('detectPlatform()', () => {
  // TikTok
  it('detects tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });
  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/456')).toBe('tiktok');
  });
  it('detects tiktok subdomain (vm.tiktok.com)', () => {
    expect(detectPlatform('https://vm.tiktok.com/ZMLxxxxxx/')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com/shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });
  it('detects youtube.com/shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/xyz')).toBe('youtube_shorts');
  });
  it('detects youtu.be short link as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/someVideoId')).toBe('youtube_shorts');
  });
  it('returns null for regular youtube.com watch URL (not shorts)', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com/reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456789')).toBe('facebook_reels');
  });
  it('detects facebook.com reel without www', () => {
    expect(detectPlatform('https://facebook.com/reel/987')).toBe('facebook_reels');
  });
  it('detects fb.watch as facebook_reels', () => {
    expect(detectPlatform('https://fb.watch/someReel/')).toBe('facebook_reels');
  });
  it('returns null for regular facebook.com post (not reel)', () => {
    expect(detectPlatform('https://www.facebook.com/groups/something')).toBeNull();
  });

  // Unknown / invalid
  it('returns null for an unknown domain', () => {
    expect(detectPlatform('https://example.com/video/123')).toBeNull();
  });
  it('returns null for a completely invalid URL', () => {
    expect(detectPlatform('not a url at all')).toBeNull();
  });
  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });
  it('returns null for Instagram URL', () => {
    expect(detectPlatform('https://www.instagram.com/reel/abc123')).toBeNull();
  });
  it('returns null for Twitter/X URL', () => {
    expect(detectPlatform('https://x.com/user/status/123')).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────
// buildAccountProfileUrl()
// ──────────────────────────────────────────────────────────
describe('buildAccountProfileUrl()', () => {
  // YouTube
  it('builds youtube URL with bare handle (no @)', () => {
    expect(buildAccountProfileUrl('youtube', 'mkbhd')).toBe('https://www.youtube.com/@mkbhd');
  });
  it('builds youtube URL with @ handle (no double @)', () => {
    expect(buildAccountProfileUrl('youtube', '@mkbhd')).toBe('https://www.youtube.com/@mkbhd');
  });

  // TikTok
  it('builds tiktok URL with bare handle', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe(
      'https://www.tiktok.com/@charlidamelio'
    );
  });
  it('builds tiktok URL stripping leading @', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe(
      'https://www.tiktok.com/@charlidamelio'
    );
  });

  // Instagram
  it('builds instagram URL with bare handle', () => {
    expect(buildAccountProfileUrl('instagram', 'natgeo')).toBe(
      'https://www.instagram.com/natgeo/'
    );
  });
  it('builds instagram URL stripping leading @', () => {
    expect(buildAccountProfileUrl('instagram', '@natgeo')).toBe(
      'https://www.instagram.com/natgeo/'
    );
  });

  // Edge cases
  it('handles handle with dots (youtube)', () => {
    expect(buildAccountProfileUrl('youtube', '@some.channel')).toBe(
      'https://www.youtube.com/@some.channel'
    );
  });
  it('handles handle with hyphens (tiktok)', () => {
    expect(buildAccountProfileUrl('tiktok', 'some-user')).toBe(
      'https://www.tiktok.com/@some-user'
    );
  });
});
