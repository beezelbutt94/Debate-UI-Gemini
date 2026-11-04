import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ─── detectPlatform ──────────────────────────────────────────────────────────

describe('detectPlatform', () => {
  // TikTok
  it('detects bare tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/456')).toBe('tiktok');
  });

  it('detects tiktok subdomain (vm.tiktok.com)', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc123')).toBe('tiktok');
  });

  it('detects m.tiktok.com (mobile subdomain)', () => {
    expect(detectPlatform('https://m.tiktok.com/@handle/video/789')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com/shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/xyz')).toBe('youtube_shorts');
  });

  it('detects youtu.be short link as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('returns null for a regular youtube.com watch URL (not /shorts/)', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('returns null for youtube.com channel URL', () => {
    expect(detectPlatform('https://www.youtube.com/@channel')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com/reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects facebook.com/reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/789')).toBe('facebook_reels');
  });

  it('detects fb.watch short link as facebook_reels', () => {
    expect(detectPlatform('https://fb.watch/someId/')).toBe('facebook_reels');
  });

  it('returns null for facebook.com non-reel page URL', () => {
    expect(detectPlatform('https://www.facebook.com/somebody/posts/123')).toBeNull();
  });

  // Unknown / invalid
  it('returns null for an unrecognised domain', () => {
    expect(detectPlatform('https://www.instagram.com/p/abc/')).toBeNull();
  });

  it('returns null for a completely invalid URL string', () => {
    expect(detectPlatform('not a url at all')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a bare domain with no path', () => {
    expect(detectPlatform('https://example.com')).toBeNull();
  });

  it('handles URL with query params for TikTok', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123?lang=en')).toBe('tiktok');
  });

  it('handles URL with hash for YouTube Shorts', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc#t=5')).toBe('youtube_shorts');
  });

  // Subdomain edge cases
  it('detects subdomain of facebook.com reels', () => {
    expect(detectPlatform('https://m.facebook.com/reel/999')).toBe('facebook_reels');
  });
});

// ─── buildAccountProfileUrl ───────────────────────────────────────────────────

describe('buildAccountProfileUrl', () => {
  // YouTube
  it('builds youtube URL for handle with @', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('builds youtube URL for handle without @, adding it', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('builds youtube URL for handle that already starts with @', () => {
    expect(buildAccountProfileUrl('youtube', '@SomeChannel')).toBe('https://www.youtube.com/@SomeChannel');
  });

  // TikTok
  it('builds tiktok URL for handle without @', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('builds tiktok URL for handle with @, stripping duplicate @', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('tiktok handle strip only the leading @, not inner characters', () => {
    expect(buildAccountProfileUrl('tiktok', '@user.name')).toBe('https://www.tiktok.com/@user.name');
  });

  // Instagram
  it('builds instagram URL for handle without @', () => {
    expect(buildAccountProfileUrl('instagram', 'nasa')).toBe('https://www.instagram.com/nasa/');
  });

  it('builds instagram URL for handle with @, stripping it', () => {
    expect(buildAccountProfileUrl('instagram', '@nasa')).toBe('https://www.instagram.com/nasa/');
  });

  it('instagram URL always has trailing slash', () => {
    const url = buildAccountProfileUrl('instagram', 'test');
    expect(url.endsWith('/')).toBe(true);
  });

  it('youtube URL uses the handle as-is when it has @', () => {
    expect(buildAccountProfileUrl('youtube', '@dot.channel-name')).toBe(
      'https://www.youtube.com/@dot.channel-name'
    );
  });
});
