import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ---------------------------------------------------------------------------
// detectPlatform
// ---------------------------------------------------------------------------

describe('detectPlatform()', () => {
  // TikTok
  it('recognises a standard tiktok.com video URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@creator/video/123')).toBe('tiktok');
  });

  it('recognises a bare tiktok.com URL (no www)', () => {
    expect(detectPlatform('https://tiktok.com/@creator/video/123')).toBe('tiktok');
  });

  it('recognises a tiktok subdomain URL (e.g. vm.tiktok.com)', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc123/')).toBe('tiktok');
  });

  it('recognises m.tiktok.com (mobile subdomain)', () => {
    expect(detectPlatform('https://m.tiktok.com/@creator/video/456')).toBe('tiktok');
  });

  // YouTube Shorts
  it('recognises a youtube.com/shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('recognises youtube.com/shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('classifies a youtu.be short link as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('returns null for a regular youtube.com watch URL (not /shorts/)', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });

  it('returns null for a youtube.com channel URL', () => {
    expect(detectPlatform('https://www.youtube.com/@SomeChannel')).toBeNull();
  });

  // Facebook Reels
  it('recognises a facebook.com/reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/987654321')).toBe('facebook_reels');
  });

  it('recognises a facebook.com/reel/ URL without www', () => {
    expect(detectPlatform('https://facebook.com/reel/987654321')).toBe('facebook_reels');
  });

  it('recognises an fb.watch short link', () => {
    expect(detectPlatform('https://fb.watch/abc123/')).toBe('facebook_reels');
  });

  it('returns null for a regular facebook.com post URL (no /reel/)', () => {
    expect(detectPlatform('https://www.facebook.com/someone/posts/12345')).toBeNull();
  });

  // Unknown / invalid
  it('returns null for an unknown domain', () => {
    expect(detectPlatform('https://example.com/video/123')).toBeNull();
  });

  it('returns null for a completely invalid string', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for instagram.com', () => {
    expect(detectPlatform('https://www.instagram.com/reel/abc')).toBeNull();
  });

  it('returns null for twitter.com', () => {
    expect(detectPlatform('https://twitter.com/i/status/123')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildAccountProfileUrl
// ---------------------------------------------------------------------------

describe('buildAccountProfileUrl()', () => {
  // YouTube
  it('builds a YouTube URL for a handle that already starts with @', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('builds a YouTube URL for a bare handle (no @), prepending @', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  // TikTok
  it('builds a TikTok URL for a handle without @', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('builds a TikTok URL for a handle with leading @, stripping the duplicate', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  // Instagram
  it('builds an Instagram URL for a bare handle', () => {
    expect(buildAccountProfileUrl('instagram', 'natgeo')).toBe('https://www.instagram.com/natgeo/');
  });

  it('builds an Instagram URL for a handle with leading @, stripping @', () => {
    expect(buildAccountProfileUrl('instagram', '@natgeo')).toBe('https://www.instagram.com/natgeo/');
  });

  it('does not double-@ a YouTube handle that already has @', () => {
    const url = buildAccountProfileUrl('youtube', '@creator');
    expect(url).not.toContain('@@');
  });

  it('does not double-@ a TikTok handle that already has @', () => {
    const url = buildAccountProfileUrl('tiktok', '@creator');
    expect(url).not.toContain('@@');
  });

  it('does not include @ in the Instagram path', () => {
    const url = buildAccountProfileUrl('instagram', '@creator');
    // path portion should not contain @
    expect(new URL(url).pathname).not.toContain('@');
  });
});
