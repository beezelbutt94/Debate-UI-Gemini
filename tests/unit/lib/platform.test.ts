import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform', () => {
  // ── TikTok ────────────────────────────────────────────────
  it('detects tiktok.com video URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok subdomain (vm.tiktok.com)', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc123')).toBe('tiktok');
  });

  it('detects m.tiktok.com', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  // ── YouTube Shorts ────────────────────────────────────────
  it('detects youtube.com/shorts URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtu.be short link', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('does NOT detect regular youtube.com/watch URL as shorts', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('does NOT detect youtube.com channel URL as shorts', () => {
    expect(detectPlatform('https://www.youtube.com/@channel')).toBeNull();
  });

  // ── Facebook Reels ────────────────────────────────────────
  it('detects facebook.com/reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects facebook.com/reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects fb.watch short link', () => {
    expect(detectPlatform('https://fb.watch/abc123')).toBe('facebook_reels');
  });

  it('detects mobile.facebook.com/reel/', () => {
    expect(detectPlatform('https://mobile.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('does NOT detect facebook.com post URL as reel', () => {
    expect(detectPlatform('https://www.facebook.com/someuser/posts/123')).toBeNull();
  });

  // ── Unknown / invalid ────────────────────────────────────
  it('returns null for instagram URL', () => {
    expect(detectPlatform('https://www.instagram.com/p/abc123/')).toBeNull();
  });

  it('returns null for twitter URL', () => {
    expect(detectPlatform('https://twitter.com/user/status/123')).toBeNull();
  });

  it('returns null for an invalid string', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for random text', () => {
    expect(detectPlatform('hello world')).toBeNull();
  });

  it('returns null for a URL with no matching host', () => {
    expect(detectPlatform('https://vimeo.com/123456789')).toBeNull();
  });
});

describe('buildAccountProfileUrl', () => {
  // ── YouTube ───────────────────────────────────────────────
  it('prefixes @ when handle lacks it', () => {
    expect(buildAccountProfileUrl('youtube', 'mychannel')).toBe(
      'https://www.youtube.com/@mychannel'
    );
  });

  it('does not double-prefix @ for youtube', () => {
    expect(buildAccountProfileUrl('youtube', '@mychannel')).toBe(
      'https://www.youtube.com/@mychannel'
    );
  });

  // ── TikTok ────────────────────────────────────────────────
  it('builds tiktok URL and strips leading @', () => {
    expect(buildAccountProfileUrl('tiktok', '@creator')).toBe(
      'https://www.tiktok.com/@creator'
    );
  });

  it('builds tiktok URL and adds @ for bare handle', () => {
    expect(buildAccountProfileUrl('tiktok', 'creator')).toBe(
      'https://www.tiktok.com/@creator'
    );
  });

  // ── Instagram ─────────────────────────────────────────────
  it('builds instagram URL and strips leading @', () => {
    expect(buildAccountProfileUrl('instagram', '@influencer')).toBe(
      'https://www.instagram.com/influencer/'
    );
  });

  it('builds instagram URL from bare handle', () => {
    expect(buildAccountProfileUrl('instagram', 'influencer')).toBe(
      'https://www.instagram.com/influencer/'
    );
  });

  it('handles handles with dots and underscores', () => {
    expect(buildAccountProfileUrl('instagram', 'my.user_name')).toBe(
      'https://www.instagram.com/my.user_name/'
    );
  });

  it('youtube with numeric handle', () => {
    expect(buildAccountProfileUrl('youtube', '123numeric')).toBe(
      'https://www.youtube.com/@123numeric'
    );
  });
});
