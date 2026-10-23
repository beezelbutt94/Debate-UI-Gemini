import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ---------------------------------------------------------------------------
// detectPlatform
// ---------------------------------------------------------------------------
describe('detectPlatform()', () => {
  // TikTok
  it('detects a standard TikTok video URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects a TikTok URL without www prefix', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects a TikTok subdomain URL (e.g. vm.tiktok.com)', () => {
    expect(detectPlatform('https://vm.tiktok.com/ZMeAbCdEf/')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects a YouTube Shorts URL with www', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects a YouTube Shorts URL without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtu.be as YouTube Shorts (short-link convention)', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('returns null for a regular YouTube watch URL (not a short)', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('returns null for a YouTube channel URL', () => {
    expect(detectPlatform('https://www.youtube.com/@channelname')).toBeNull();
  });

  // Facebook Reels
  it('detects a Facebook Reel URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects a Facebook Reel URL without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects fb.watch as Facebook Reels', () => {
    expect(detectPlatform('https://fb.watch/abc123')).toBe('facebook_reels');
  });

  it('detects a Facebook subdomain reel URL', () => {
    expect(detectPlatform('https://m.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('returns null for a Facebook non-reel URL', () => {
    expect(detectPlatform('https://www.facebook.com/someuser/posts/123')).toBeNull();
  });

  // Invalid / unrecognized
  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a non-URL string', () => {
    expect(detectPlatform('not a url')).toBeNull();
  });

  it('returns null for an Instagram URL', () => {
    expect(detectPlatform('https://www.instagram.com/reel/abc123')).toBeNull();
  });

  it('returns null for a Twitter URL', () => {
    expect(detectPlatform('https://twitter.com/user/status/123')).toBeNull();
  });

  it('returns null for localhost', () => {
    expect(detectPlatform('http://localhost:3000/shorts/abc')).toBeNull();
  });

  it('handles a URL with query params and fragment', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123?lang=en#comments')).toBe('tiktok');
  });

  it('returns null for a plain http URL to an unknown host', () => {
    expect(detectPlatform('http://example.com/shorts/abc')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildAccountProfileUrl
// ---------------------------------------------------------------------------
describe('buildAccountProfileUrl()', () => {
  // YouTube
  it('builds a YouTube profile URL for a handle with @', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('builds a YouTube profile URL for a handle without @ (adds it)', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('does not double-@ a YouTube handle', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).not.toContain('@@');
  });

  // TikTok
  it('builds a TikTok profile URL for a handle with @', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('builds a TikTok profile URL for a handle without @', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('does not double-@ a TikTok handle', () => {
    expect(buildAccountProfileUrl('tiktok', '@handle')).not.toContain('@@');
  });

  // Instagram
  it('builds an Instagram profile URL for a handle with @', () => {
    expect(buildAccountProfileUrl('instagram', '@nasa')).toBe('https://www.instagram.com/nasa/');
  });

  it('builds an Instagram profile URL for a handle without @', () => {
    expect(buildAccountProfileUrl('instagram', 'nasa')).toBe('https://www.instagram.com/nasa/');
  });

  it('does not double-@ an Instagram handle (strips @)', () => {
    expect(buildAccountProfileUrl('instagram', '@nasa')).not.toContain('@');
  });

  it('all resulting URLs start with https://', () => {
    const platforms = ['youtube', 'tiktok', 'instagram'] as const;
    for (const p of platforms) {
      expect(buildAccountProfileUrl(p, 'testhandle')).toMatch(/^https:\/\//);
    }
  });
});
