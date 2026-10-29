import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ─────────────────────────────────────────────────────────────────────────────
// detectPlatform
// ─────────────────────────────────────────────────────────────────────────────

describe('detectPlatform()', () => {
  // TikTok
  it('identifies a plain tiktok.com URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('identifies tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/456')).toBe('tiktok');
  });

  it('identifies a tiktok subdomain', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/789')).toBe('tiktok');
  });

  // YouTube Shorts
  it('identifies a YouTube Shorts URL with /shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('identifies youtube.com/shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/xyz')).toBe('youtube_shorts');
  });

  it('identifies a youtu.be short link', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('returns null for a regular YouTube video (no /shorts/)', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('returns null for a YouTube channel URL', () => {
    expect(detectPlatform('https://www.youtube.com/@channelname')).toBeNull();
  });

  // Facebook Reels
  it('identifies a facebook.com/reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/1234567890')).toBe('facebook_reels');
  });

  it('identifies facebook.com/reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/1234567890')).toBe('facebook_reels');
  });

  it('identifies an fb.watch URL', () => {
    expect(detectPlatform('https://fb.watch/abc123/')).toBe('facebook_reels');
  });

  it('returns null for a facebook.com URL that is not a reel', () => {
    expect(detectPlatform('https://www.facebook.com/groups/12345')).toBeNull();
  });

  // Unknown/invalid
  it('returns null for an Instagram URL', () => {
    expect(detectPlatform('https://www.instagram.com/p/abcdef/')).toBeNull();
  });

  it('returns null for a completely unrelated URL', () => {
    expect(detectPlatform('https://example.com/video/123')).toBeNull();
  });

  it('returns null for an empty string (invalid URL)', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a non-URL string', () => {
    expect(detectPlatform('not a url at all')).toBeNull();
  });

  it('returns null for a bare domain with no protocol', () => {
    expect(detectPlatform('tiktok.com/@user')).toBeNull();
  });

  // Edge cases for subdomains
  it('identifies m.facebook.com/reel/ as facebook_reels', () => {
    expect(detectPlatform('https://m.facebook.com/reel/987654321')).toBe('facebook_reels');
  });

  it('identifies m.youtube.com/shorts/ as youtube_shorts', () => {
    expect(detectPlatform('https://m.youtube.com/shorts/abc')).toBe('youtube_shorts');
  });

  it('does NOT treat youtu.be with /shorts/ path differently from normal youtu.be', () => {
    // youtu.be is always youtube_shorts regardless of path
    expect(detectPlatform('https://youtu.be/someVideoId')).toBe('youtube_shorts');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// buildAccountProfileUrl
// ─────────────────────────────────────────────────────────────────────────────

describe('buildAccountProfileUrl()', () => {
  // YouTube
  it('builds YouTube URL from handle without @', () => {
    expect(buildAccountProfileUrl('youtube', 'mychannel')).toBe('https://www.youtube.com/@mychannel');
  });

  it('builds YouTube URL from handle with @ already included', () => {
    expect(buildAccountProfileUrl('youtube', '@mychannel')).toBe('https://www.youtube.com/@mychannel');
  });

  // TikTok
  it('builds TikTok URL from handle without @', () => {
    expect(buildAccountProfileUrl('tiktok', 'creator')).toBe('https://www.tiktok.com/@creator');
  });

  it('builds TikTok URL from handle with @ already included (strips duplicate)', () => {
    expect(buildAccountProfileUrl('tiktok', '@creator')).toBe('https://www.tiktok.com/@creator');
  });

  // Instagram
  it('builds Instagram URL from handle without @', () => {
    expect(buildAccountProfileUrl('instagram', 'user')).toBe('https://www.instagram.com/user/');
  });

  it('builds Instagram URL from handle with @ already included (strips @)', () => {
    expect(buildAccountProfileUrl('instagram', '@user')).toBe('https://www.instagram.com/user/');
  });

  // Edge cases
  it('handles YouTube handle with numbers', () => {
    expect(buildAccountProfileUrl('youtube', 'channel123')).toBe('https://www.youtube.com/@channel123');
  });

  it('handles TikTok handle with underscores', () => {
    expect(buildAccountProfileUrl('tiktok', 'my_creator')).toBe('https://www.tiktok.com/@my_creator');
  });

  it('handles Instagram handle with dots', () => {
    expect(buildAccountProfileUrl('instagram', 'my.creator')).toBe('https://www.instagram.com/my.creator/');
  });

  it('returns a string starting with https://', () => {
    const url = buildAccountProfileUrl('youtube', 'test');
    expect(url.startsWith('https://')).toBe(true);
  });
});
