import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform()', () => {
  // --- TikTok ---
  it('recognises tiktok.com URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('recognises tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/456')).toBe('tiktok');
  });

  it('recognises tiktok subdomain', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/789')).toBe('tiktok');
  });

  // --- YouTube Shorts ---
  it('recognises youtube.com /shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abcdef')).toBe('youtube_shorts');
  });

  it('recognises youtube.com /shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc')).toBe('youtube_shorts');
  });

  it('recognises youtu.be short link', () => {
    expect(detectPlatform('https://youtu.be/abcdef')).toBe('youtube_shorts');
  });

  it('does NOT classify regular youtube.com watch URL as shorts', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abcdef')).toBeNull();
  });

  // --- Facebook Reels ---
  it('recognises facebook.com /reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('recognises facebook.com /reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/654321')).toBe('facebook_reels');
  });

  it('recognises fb.watch URL', () => {
    expect(detectPlatform('https://fb.watch/xyzabc')).toBe('facebook_reels');
  });

  it('does NOT classify facebook.com non-reel URL', () => {
    expect(detectPlatform('https://www.facebook.com/groups/somegroup')).toBeNull();
  });

  // --- Unknown / invalid ---
  it('returns null for an unrecognised domain', () => {
    expect(detectPlatform('https://instagram.com/reel/abc')).toBeNull();
  });

  it('returns null for a completely invalid URL string', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a plain domain without protocol', () => {
    expect(detectPlatform('tiktok.com/@user/video/123')).toBeNull();
  });

  it('returns null for a Twitter URL', () => {
    expect(detectPlatform('https://twitter.com/user/status/123')).toBeNull();
  });

  it('returns null for a vimeo URL', () => {
    expect(detectPlatform('https://vimeo.com/12345')).toBeNull();
  });
});

describe('buildAccountProfileUrl()', () => {
  // --- YouTube ---
  it('builds YouTube URL with @ prefix when handle lacks one', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('does not double-@ when handle already starts with @', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('builds YouTube URL for handle with special chars', () => {
    expect(buildAccountProfileUrl('youtube', 'creator_123')).toBe('https://www.youtube.com/@creator_123');
  });

  // --- TikTok ---
  it('builds TikTok URL without @ handle', () => {
    expect(buildAccountProfileUrl('tiktok', 'username')).toBe('https://www.tiktok.com/@username');
  });

  it('strips leading @ from TikTok handle', () => {
    expect(buildAccountProfileUrl('tiktok', '@username')).toBe('https://www.tiktok.com/@username');
  });

  it('does not double-@ for TikTok', () => {
    expect(buildAccountProfileUrl('tiktok', '@@username')).toBe('https://www.tiktok.com/@@username');
    // only one leading @ is stripped
  });

  // --- Instagram ---
  it('builds Instagram URL without @ handle', () => {
    expect(buildAccountProfileUrl('instagram', 'creator')).toBe('https://www.instagram.com/creator/');
  });

  it('strips leading @ from Instagram handle', () => {
    expect(buildAccountProfileUrl('instagram', '@creator')).toBe('https://www.instagram.com/creator/');
  });

  it('builds Instagram URL with trailing slash', () => {
    const url = buildAccountProfileUrl('instagram', 'someuser');
    expect(url.endsWith('/')).toBe(true);
  });
});
