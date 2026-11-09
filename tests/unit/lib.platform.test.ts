import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ─── detectPlatform ─────────────────────────────────────────────────────────

describe('detectPlatform', () => {
  // TikTok
  it('detects bare tiktok.com URL', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects www.tiktok.com (strips www)', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/456')).toBe('tiktok');
  });

  it('detects subdomain of tiktok.com', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com/shorts URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtu.be as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('does NOT detect youtube.com without /shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('does NOT detect youtube.com/channel/... as shorts', () => {
    expect(detectPlatform('https://www.youtube.com/channel/UCxyz')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com/reel URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects facebook.com/reel without www', () => {
    expect(detectPlatform('https://facebook.com/reel/789')).toBe('facebook_reels');
  });

  it('detects fb.watch URL', () => {
    expect(detectPlatform('https://fb.watch/abc')).toBe('facebook_reels');
  });

  it('does NOT detect facebook.com without /reel/', () => {
    expect(detectPlatform('https://www.facebook.com/someuser/posts/123')).toBeNull();
  });

  // Unknown / other
  it('returns null for instagram.com', () => {
    expect(detectPlatform('https://www.instagram.com/p/abc/')).toBeNull();
  });

  it('returns null for twitter.com', () => {
    expect(detectPlatform('https://twitter.com/status/123')).toBeNull();
  });

  it('returns null for a bare hostname', () => {
    expect(detectPlatform('https://example.com')).toBeNull();
  });

  it('returns null for an invalid URL', () => {
    expect(detectPlatform('not a url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a URL with no recognizable host', () => {
    expect(detectPlatform('ftp://tiktok.example.org/video')).toBeNull();
  });

  it('detects subdomain of facebook.com with reel path', () => {
    expect(detectPlatform('https://m.facebook.com/reel/999')).toBe('facebook_reels');
  });
});

// ─── buildAccountProfileUrl ─────────────────────────────────────────────────

describe('buildAccountProfileUrl', () => {
  // YouTube
  it('prefixes @ for a plain youtube handle', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('does not double-prefix @ for a youtube handle that already starts with @', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  // TikTok
  it('strips leading @ before inserting @ for tiktok', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('adds @ for a plain tiktok handle', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  // Instagram
  it('strips leading @ for instagram handle', () => {
    expect(buildAccountProfileUrl('instagram', '@natgeo')).toBe('https://www.instagram.com/natgeo/');
  });

  it('leaves a plain instagram handle as-is (no @ stripped)', () => {
    expect(buildAccountProfileUrl('instagram', 'natgeo')).toBe('https://www.instagram.com/natgeo/');
  });

  it('instagram URL always ends with trailing slash', () => {
    const url = buildAccountProfileUrl('instagram', 'test');
    expect(url.endsWith('/')).toBe(true);
  });

  it('youtube URL never starts with @@', () => {
    const url = buildAccountProfileUrl('youtube', '@already');
    expect(url).not.toContain('@@');
  });

  it('tiktok URL never starts with @@', () => {
    const url = buildAccountProfileUrl('tiktok', '@already');
    expect(url).not.toContain('@@');
  });
});
