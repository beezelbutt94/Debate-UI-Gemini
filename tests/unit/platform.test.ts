import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform()', () => {
  // ── TikTok ───────────────────────────────────────────────────────────────
  it('detects plain tiktok.com', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects www.tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects subdomain.tiktok.com', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc123/')).toBe('tiktok');
  });

  it('detects tiktok.com without path', () => {
    expect(detectPlatform('https://tiktok.com')).toBe('tiktok');
  });

  // ── YouTube Shorts ───────────────────────────────────────────────────────
  it('detects youtube.com/shorts/', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects www.youtube.com/shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtu.be short links', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('returns null for a youtube.com non-shorts URL', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('returns null for youtube.com channel page', () => {
    expect(detectPlatform('https://www.youtube.com/@creator')).toBeNull();
  });

  // ── Facebook Reels ───────────────────────────────────────────────────────
  it('detects facebook.com/reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('detects plain facebook.com/reel/', () => {
    expect(detectPlatform('https://facebook.com/reel/123')).toBe('facebook_reels');
  });

  it('detects fb.watch short links', () => {
    expect(detectPlatform('https://fb.watch/abc')).toBe('facebook_reels');
  });

  it('returns null for a regular facebook.com post (no /reel/)', () => {
    expect(detectPlatform('https://www.facebook.com/photo?fbid=123')).toBeNull();
  });

  it('returns null for facebook.com profile page', () => {
    expect(detectPlatform('https://www.facebook.com/creator')).toBeNull();
  });

  // ── Invalid inputs ────────────────────────────────────────────────────────
  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a totally random string', () => {
    expect(detectPlatform('not a url at all')).toBeNull();
  });

  it('returns null for an unknown platform URL', () => {
    expect(detectPlatform('https://instagram.com/reels/abc')).toBeNull();
  });

  it('returns null for a Twitter/X URL', () => {
    expect(detectPlatform('https://twitter.com/i/status/123')).toBeNull();
  });

  it('returns null for a bare domain with no protocol', () => {
    expect(detectPlatform('tiktok.com/@user')).toBeNull();
  });

  it('returns null for an IP address URL', () => {
    expect(detectPlatform('http://192.168.1.1/tiktok.com')).toBeNull();
  });

  it('handles a URL with query params and fragment', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123?is_from_webapp=1#comment')).toBe('tiktok');
  });
});

describe('buildAccountProfileUrl()', () => {
  // ── YouTube ───────────────────────────────────────────────────────────────
  it('prepends @ when handle lacks it on youtube', () => {
    expect(buildAccountProfileUrl('youtube', 'mychannel')).toBe('https://www.youtube.com/@mychannel');
  });

  it('does not double-prepend @ on youtube', () => {
    expect(buildAccountProfileUrl('youtube', '@mychannel')).toBe('https://www.youtube.com/@mychannel');
  });

  it('handles a YouTube handle with uppercase letters', () => {
    expect(buildAccountProfileUrl('youtube', 'MyChannel')).toBe('https://www.youtube.com/@MyChannel');
  });

  // ── TikTok ────────────────────────────────────────────────────────────────
  it('strips leading @ and re-adds it on tiktok', () => {
    expect(buildAccountProfileUrl('tiktok', '@creator')).toBe('https://www.tiktok.com/@creator');
  });

  it('adds @ when tiktok handle has no leading @', () => {
    expect(buildAccountProfileUrl('tiktok', 'creator')).toBe('https://www.tiktok.com/@creator');
  });

  it('handles a TikTok handle with dots', () => {
    expect(buildAccountProfileUrl('tiktok', 'creator.name')).toBe('https://www.tiktok.com/@creator.name');
  });

  // ── Instagram ─────────────────────────────────────────────────────────────
  it('strips leading @ from instagram handle', () => {
    expect(buildAccountProfileUrl('instagram', '@user')).toBe('https://www.instagram.com/user/');
  });

  it('adds trailing slash on instagram without @', () => {
    expect(buildAccountProfileUrl('instagram', 'user')).toBe('https://www.instagram.com/user/');
  });

  it('handles instagram handle with underscores', () => {
    expect(buildAccountProfileUrl('instagram', 'my_profile_123')).toBe('https://www.instagram.com/my_profile_123/');
  });
});
