import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ─── detectPlatform ───────────────────────────────────────────────────────────

describe('detectPlatform', () => {
  // TikTok
  it('detects tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects bare tiktok.com (no www)', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok subdomains', () => {
    expect(detectPlatform('https://vm.tiktok.com/some-slug/')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com/shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/xyz')).toBe('youtube_shorts');
  });

  it('detects youtu.be short links', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('does NOT treat regular youtube.com watch URLs as shorts', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com/reel/', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects facebook.com/reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/789')).toBe('facebook_reels');
  });

  it('detects fb.watch links', () => {
    expect(detectPlatform('https://fb.watch/someslug/')).toBe('facebook_reels');
  });

  it('does NOT treat regular facebook.com posts as reels', () => {
    expect(detectPlatform('https://www.facebook.com/someuser/posts/123')).toBeNull();
  });

  // Edge / null cases
  it('returns null for an unknown domain', () => {
    expect(detectPlatform('https://www.example.com/video/123')).toBeNull();
  });

  it('returns null for an invalid URL', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for instagram (unsupported)', () => {
    expect(detectPlatform('https://www.instagram.com/reel/abc/')).toBeNull();
  });

  it('returns null for twitter/X', () => {
    expect(detectPlatform('https://twitter.com/user/status/123')).toBeNull();
  });

  it('detects m.tiktok.com (mobile subdomain)', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/123456789')).toBe('tiktok');
  });

  it('detects youtube shorts with extra query params', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123?feature=share')).toBe('youtube_shorts');
  });

  it('returns null for youtube.com/channel/ URL (no shorts)', () => {
    expect(detectPlatform('https://www.youtube.com/channel/UC1234')).toBeNull();
  });

  it('detects m.facebook.com/reel/ (mobile facebook reel)', () => {
    expect(detectPlatform('https://m.facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('returns null for facebook.com/video/ (not a reel)', () => {
    expect(detectPlatform('https://www.facebook.com/video/123456789')).toBeNull();
  });

  it('returns null for facebook.com/groups/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/groups/mycommunity/permalink/123')).toBeNull();
  });

  it('returns null for a URL with only a scheme', () => {
    expect(detectPlatform('https://')).toBeNull();
  });
});

// ─── buildAccountProfileUrl ───────────────────────────────────────────────────

describe('buildAccountProfileUrl', () => {
  // YouTube
  it('adds @ to bare youtube handle', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('does not double the @ for youtube', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  // TikTok
  it('strips leading @ for tiktok', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('adds @ to bare tiktok handle', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  // Instagram
  it('strips leading @ for instagram', () => {
    expect(buildAccountProfileUrl('instagram', '@nasa')).toBe('https://www.instagram.com/nasa/');
  });

  it('adds trailing slash for instagram without @', () => {
    expect(buildAccountProfileUrl('instagram', 'nasa')).toBe('https://www.instagram.com/nasa/');
  });

  it('handles handle with numbers and underscores', () => {
    expect(buildAccountProfileUrl('tiktok', 'user_123')).toBe('https://www.tiktok.com/@user_123');
  });

  // Instagram extra cases
  it('handles all-lowercase instagram handle', () => {
    expect(buildAccountProfileUrl('instagram', 'mynewpage')).toBe('https://www.instagram.com/mynewpage/');
  });

  it('handles instagram handle with dots', () => {
    expect(buildAccountProfileUrl('instagram', 'my.page.123')).toBe('https://www.instagram.com/my.page.123/');
  });

  // YouTube extra cases
  it('handles youtube handle that is all uppercase', () => {
    expect(buildAccountProfileUrl('youtube', 'PEWDIEPIE')).toBe('https://www.youtube.com/@PEWDIEPIE');
  });

  // TikTok extra cases
  it('handles tiktok handle with dots', () => {
    expect(buildAccountProfileUrl('tiktok', 'creator.name')).toBe('https://www.tiktok.com/@creator.name');
  });
});
