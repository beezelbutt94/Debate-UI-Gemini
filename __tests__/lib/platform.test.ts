import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform', () => {
  // TikTok
  it('detects tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects subdomain of tiktok.com', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com /shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com /shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/xyz')).toBe('youtube_shorts');
  });

  it('detects youtu.be as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('does NOT detect youtube.com without /shorts/ in URL', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com /reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects facebook.com /reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects fb.watch URL', () => {
    expect(detectPlatform('https://fb.watch/abcdef/')).toBe('facebook_reels');
  });

  it('does NOT detect facebook.com non-reel URL', () => {
    expect(detectPlatform('https://www.facebook.com/profile/photos')).toBeNull();
  });

  // Null cases
  it('returns null for unknown domain', () => {
    expect(detectPlatform('https://example.com/video/123')).toBeNull();
  });

  it('returns null for instagram', () => {
    expect(detectPlatform('https://www.instagram.com/reel/abc')).toBeNull();
  });

  it('returns null for malformed URL', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for twitter URL', () => {
    expect(detectPlatform('https://twitter.com/user/status/123')).toBeNull();
  });

  it('returns null for vimeo URL', () => {
    expect(detectPlatform('https://vimeo.com/123456')).toBeNull();
  });
});

describe('buildAccountProfileUrl', () => {
  // YouTube
  it('builds youtube URL with @ handle', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('builds youtube URL without @ prefix — adds it', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  // TikTok
  it('builds tiktok URL with @ prefix — strips and re-adds', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('builds tiktok URL without @ prefix — adds it', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  // Instagram
  it('builds instagram URL with @ prefix — strips it', () => {
    expect(buildAccountProfileUrl('instagram', '@natgeo')).toBe('https://www.instagram.com/natgeo/');
  });

  it('builds instagram URL without @ prefix', () => {
    expect(buildAccountProfileUrl('instagram', 'natgeo')).toBe('https://www.instagram.com/natgeo/');
  });

  it('builds instagram URL for handle with underscores', () => {
    expect(buildAccountProfileUrl('instagram', 'some_user_name')).toBe('https://www.instagram.com/some_user_name/');
  });

  it('builds youtube URL with mixed case handle', () => {
    expect(buildAccountProfileUrl('youtube', 'TechChannel')).toBe('https://www.youtube.com/@TechChannel');
  });

  it('does not double-add @ for youtube', () => {
    expect(buildAccountProfileUrl('youtube', '@@weird')).toBe('https://www.youtube.com/@@weird');
  });

  it('strips only one @ for tiktok', () => {
    expect(buildAccountProfileUrl('tiktok', '@user')).toBe('https://www.tiktok.com/@user');
  });
});
