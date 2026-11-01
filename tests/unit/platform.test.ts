import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ─── detectPlatform ───────────────────────────────────────────────────────────

describe('detectPlatform', () => {
  // TikTok
  it('detects tiktok.com URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/12345')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/12345')).toBe('tiktok');
  });

  it('detects subdomain of tiktok.com', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc')).toBe('tiktok');
  });

  it('detects m.tiktok.com (mobile)', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com /shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com /shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('does NOT detect a regular youtube.com watch URL as shorts', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('detects youtu.be short link as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  // Facebook Reels
  it('detects facebook.com /reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/12345')).toBe('facebook_reels');
  });

  it('detects facebook.com /reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/12345')).toBe('facebook_reels');
  });

  it('detects fb.watch URL as facebook_reels', () => {
    expect(detectPlatform('https://fb.watch/abc')).toBe('facebook_reels');
  });

  it('does NOT detect a regular facebook.com post as reels', () => {
    expect(detectPlatform('https://www.facebook.com/photo/?fbid=123')).toBeNull();
  });

  it('detects subdomain of facebook.com with /reel/', () => {
    expect(detectPlatform('https://m.facebook.com/reel/99999')).toBe('facebook_reels');
  });

  // Edge cases / null returns
  it('returns null for an unsupported domain', () => {
    expect(detectPlatform('https://instagram.com/p/xyz')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a non-URL string', () => {
    expect(detectPlatform('not a url')).toBeNull();
  });

  it('returns null for a bare hostname string without scheme', () => {
    expect(detectPlatform('tiktok.com/@user/video/123')).toBeNull();
  });

  it('returns null for a twitter/X URL', () => {
    expect(detectPlatform('https://twitter.com/user/status/123')).toBeNull();
  });

  it('returns null for a random URL', () => {
    expect(detectPlatform('https://example.com/video/123')).toBeNull();
  });

  it('returns null for a URL that looks like tiktok but is not', () => {
    expect(detectPlatform('https://faketiktok.com/@user')).toBeNull();
  });

  it('returns null for undefined-like input coerced (NaN)', () => {
    // @ts-expect-error intentional wrong type
    expect(detectPlatform(undefined)).toBeNull();
  });
});

// ─── buildAccountProfileUrl ───────────────────────────────────────────────────

describe('buildAccountProfileUrl', () => {
  // YouTube
  it('builds YouTube URL for handle with @', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('builds YouTube URL for handle without @, adding it', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('builds YouTube URL for handle that is just @', () => {
    expect(buildAccountProfileUrl('youtube', '@')).toBe('https://www.youtube.com/@');
  });

  // TikTok
  it('builds TikTok URL for handle with @, stripping it', () => {
    expect(buildAccountProfileUrl('tiktok', '@khaby.lame')).toBe('https://www.tiktok.com/@khaby.lame');
  });

  it('builds TikTok URL for handle without @', () => {
    expect(buildAccountProfileUrl('tiktok', 'khaby.lame')).toBe('https://www.tiktok.com/@khaby.lame');
  });

  it('does not double-@ for TikTok handle already without @', () => {
    expect(buildAccountProfileUrl('tiktok', 'user123')).toBe('https://www.tiktok.com/@user123');
  });

  // Instagram
  it('builds Instagram URL for handle without @', () => {
    expect(buildAccountProfileUrl('instagram', 'natgeo')).toBe('https://www.instagram.com/natgeo/');
  });

  it('builds Instagram URL for handle with @, stripping it', () => {
    expect(buildAccountProfileUrl('instagram', '@natgeo')).toBe('https://www.instagram.com/natgeo/');
  });

  it('builds Instagram URL and always ends with trailing slash', () => {
    const url = buildAccountProfileUrl('instagram', 'test');
    expect(url.endsWith('/')).toBe(true);
  });

  // Structural checks
  it('YouTube URL starts with https://www.youtube.com/', () => {
    const url = buildAccountProfileUrl('youtube', 'myhandle');
    expect(url.startsWith('https://www.youtube.com/')).toBe(true);
  });

  it('TikTok URL starts with https://www.tiktok.com/', () => {
    const url = buildAccountProfileUrl('tiktok', 'myhandle');
    expect(url.startsWith('https://www.tiktok.com/')).toBe(true);
  });

  it('Instagram URL starts with https://www.instagram.com/', () => {
    const url = buildAccountProfileUrl('instagram', 'myhandle');
    expect(url.startsWith('https://www.instagram.com/')).toBe(true);
  });
});
