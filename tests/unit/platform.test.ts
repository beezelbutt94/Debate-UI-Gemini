import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform()', () => {
  // TikTok
  it('detects bare tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/456')).toBe('tiktok');
  });

  it('detects subdomain of tiktok.com', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc123/')).toBe('tiktok');
  });

  it('detects tiktok mobile short link', () => {
    expect(detectPlatform('https://m.tiktok.com/@creator/video/789')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com/shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube subdomain with shorts path', () => {
    expect(detectPlatform('https://m.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtu.be short URL as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('does NOT detect youtube.com without /shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('does NOT detect youtube.com channel page', () => {
    expect(detectPlatform('https://www.youtube.com/@creator')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com/reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('detects facebook.com/reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/987654321')).toBe('facebook_reels');
  });

  it('detects fb.watch short URL', () => {
    expect(detectPlatform('https://fb.watch/abc123/')).toBe('facebook_reels');
  });

  it('detects facebook subdomain with reel path', () => {
    expect(detectPlatform('https://m.facebook.com/reel/99999')).toBe('facebook_reels');
  });

  it('does NOT detect facebook.com without /reel/', () => {
    expect(detectPlatform('https://www.facebook.com/someuser/videos/123')).toBeNull();
  });

  it('does NOT detect facebook.com posts', () => {
    expect(detectPlatform('https://www.facebook.com/story.php?id=123')).toBeNull();
  });

  // Unrecognized / invalid
  it('returns null for arbitrary URL', () => {
    expect(detectPlatform('https://example.com/video')).toBeNull();
  });

  it('returns null for Instagram URL', () => {
    expect(detectPlatform('https://www.instagram.com/reel/abc123/')).toBeNull();
  });

  it('returns null for Twitter URL', () => {
    expect(detectPlatform('https://twitter.com/user/status/123')).toBeNull();
  });

  it('returns null for invalid URL string', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for URL with only a hostname', () => {
    expect(detectPlatform('https://tiktok.evil.com/@user')).toBeNull();
  });

  it('returns null for vimeo', () => {
    expect(detectPlatform('https://vimeo.com/123456')).toBeNull();
  });

  it('handles URL with query params for tiktok', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123?referrer=share')).toBe('tiktok');
  });

  it('handles URL with query params for youtube shorts', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123?feature=share')).toBe('youtube_shorts');
  });
});

describe('buildAccountProfileUrl()', () => {
  // YouTube
  it('builds youtube URL with @ handle', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('adds @ prefix when missing for youtube', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('does not double-add @ for youtube', () => {
    expect(buildAccountProfileUrl('youtube', '@creator')).toBe('https://www.youtube.com/@creator');
  });

  // TikTok
  it('builds tiktok URL stripping leading @', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe(
      'https://www.tiktok.com/@charlidamelio'
    );
  });

  it('builds tiktok URL adding @ when missing', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe(
      'https://www.tiktok.com/@charlidamelio'
    );
  });

  it('does not double-add @ for tiktok', () => {
    expect(buildAccountProfileUrl('tiktok', '@user')).toBe('https://www.tiktok.com/@user');
  });

  // Instagram
  it('builds instagram URL stripping leading @', () => {
    expect(buildAccountProfileUrl('instagram', '@kylie')).toBe('https://www.instagram.com/kylie/');
  });

  it('builds instagram URL without @', () => {
    expect(buildAccountProfileUrl('instagram', 'kylie')).toBe('https://www.instagram.com/kylie/');
  });

  it('does not double-add @ for instagram', () => {
    expect(buildAccountProfileUrl('instagram', '@creator')).toBe(
      'https://www.instagram.com/creator/'
    );
  });

  it('handles handle with numbers and underscores for youtube', () => {
    expect(buildAccountProfileUrl('youtube', 'user_123')).toBe('https://www.youtube.com/@user_123');
  });

  it('handles handle with dots for instagram', () => {
    expect(buildAccountProfileUrl('instagram', 'user.name')).toBe(
      'https://www.instagram.com/user.name/'
    );
  });

  it('handles handle with dots for tiktok', () => {
    expect(buildAccountProfileUrl('tiktok', 'user.name')).toBe(
      'https://www.tiktok.com/@user.name'
    );
  });
});
