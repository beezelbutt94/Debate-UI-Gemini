import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform()', () => {
  // --- TikTok ---
  it('detects tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/@creator/video/123')).toBe('tiktok');
  });

  it('detects bare tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@creator/video/123')).toBe('tiktok');
  });

  it('detects a tiktok subdomain', () => {
    expect(detectPlatform('https://vm.tiktok.com/XXXXXXX/')).toBe('tiktok');
  });

  // --- YouTube Shorts ---
  it('detects youtube.com/shorts URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/def456')).toBe('youtube_shorts');
  });

  it('detects youtu.be short links as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('returns null for a regular youtube.com/watch URL (not shorts)', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  // --- Facebook Reels ---
  it('detects facebook.com/reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('detects facebook.com/reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/987654')).toBe('facebook_reels');
  });

  it('detects fb.watch short links', () => {
    expect(detectPlatform('https://fb.watch/shortlink/')).toBe('facebook_reels');
  });

  it('returns null for facebook.com non-reel page', () => {
    expect(detectPlatform('https://www.facebook.com/someone/posts/12345')).toBeNull();
  });

  // --- Invalid / Unknown ---
  it('returns null for an unsupported domain', () => {
    expect(detectPlatform('https://instagram.com/p/xyz')).toBeNull();
  });

  it('returns null for a non-URL string', () => {
    expect(detectPlatform('not a url')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a bare hostname with no scheme', () => {
    expect(detectPlatform('tiktok.com/@creator')).toBeNull();
  });

  it('returns null for a twitter URL', () => {
    expect(detectPlatform('https://twitter.com/i/status/1234')).toBeNull();
  });

  it('returns null for a vimeo URL', () => {
    expect(detectPlatform('https://vimeo.com/123456789')).toBeNull();
  });
});

describe('buildAccountProfileUrl()', () => {
  // --- YouTube ---
  it('prepends @ to a bare youtube handle', () => {
    expect(buildAccountProfileUrl('youtube', 'creator')).toBe('https://www.youtube.com/@creator');
  });

  it('does not double-prepend @ to a youtube handle', () => {
    expect(buildAccountProfileUrl('youtube', '@creator')).toBe('https://www.youtube.com/@creator');
  });

  // --- TikTok ---
  it('prepends @ to a bare tiktok handle', () => {
    expect(buildAccountProfileUrl('tiktok', 'mychannel')).toBe('https://www.tiktok.com/@mychannel');
  });

  it('does not double-prepend @ to a tiktok handle', () => {
    expect(buildAccountProfileUrl('tiktok', '@mychannel')).toBe('https://www.tiktok.com/@mychannel');
  });

  // --- Instagram ---
  it('builds an instagram URL without @ prefix in path', () => {
    expect(buildAccountProfileUrl('instagram', 'mypage')).toBe('https://www.instagram.com/mypage/');
  });

  it('strips leading @ from an instagram handle', () => {
    expect(buildAccountProfileUrl('instagram', '@mypage')).toBe('https://www.instagram.com/mypage/');
  });

  it('uses exact handle for youtube when handle starts with @', () => {
    expect(buildAccountProfileUrl('youtube', '@mkbhd')).toBe('https://www.youtube.com/@mkbhd');
  });

  it('handles handles with uppercase letters', () => {
    const url = buildAccountProfileUrl('tiktok', 'MyCreator');
    expect(url).toBe('https://www.tiktok.com/@MyCreator');
  });

  it('handles handles with underscores', () => {
    const url = buildAccountProfileUrl('instagram', 'my_creator_page');
    expect(url).toBe('https://www.instagram.com/my_creator_page/');
  });

  it('handles handles with numbers', () => {
    const url = buildAccountProfileUrl('youtube', 'creator123');
    expect(url).toBe('https://www.youtube.com/@creator123');
  });
});
