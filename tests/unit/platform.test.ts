import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ── detectPlatform ────────────────────────────────────────────────────────────

describe('detectPlatform', () => {
  // TikTok
  it('detects tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/12345')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/12345')).toBe('tiktok');
  });

  it('detects vm.tiktok.com subdomain', () => {
    expect(detectPlatform('https://vm.tiktok.com/abcdef/')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com/shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtu.be short link', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('returns null for youtube.com watch (not a short)', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com/reel/', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('detects facebook.com/reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('detects fb.watch link', () => {
    expect(detectPlatform('https://fb.watch/abcdef')).toBe('facebook_reels');
  });

  it('returns null for facebook.com post without /reel/', () => {
    expect(detectPlatform('https://www.facebook.com/photo?fbid=123')).toBeNull();
  });

  // Unknown / invalid
  it('returns null for instagram.com (not supported)', () => {
    expect(detectPlatform('https://www.instagram.com/reel/abc')).toBeNull();
  });

  it('returns null for plain text (not a URL)', () => {
    expect(detectPlatform('not a url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for an unrecognised domain', () => {
    expect(detectPlatform('https://example.com/video/123')).toBeNull();
  });

  it('returns null for a malformed URL with only the scheme', () => {
    expect(detectPlatform('https://')).toBeNull();
  });

  // Edge: subdomain matching must not over-match
  it('does not match fakefacebook.com as facebook_reels', () => {
    expect(detectPlatform('https://fakefacebook.com/reel/123')).toBeNull();
  });

  it('does not match faketiktok.com as tiktok', () => {
    expect(detectPlatform('https://faketiktok.com/@user/video/1')).toBeNull();
  });
});

// ── buildAccountProfileUrl ────────────────────────────────────────────────────

describe('buildAccountProfileUrl', () => {
  // YouTube
  it('prepends @ to a bare youtube handle', () => {
    expect(buildAccountProfileUrl('youtube', 'mychannel')).toBe('https://www.youtube.com/@mychannel');
  });

  it('does not double-@ a youtube handle', () => {
    expect(buildAccountProfileUrl('youtube', '@mychannel')).toBe('https://www.youtube.com/@mychannel');
  });

  // TikTok
  it('builds tiktok URL from bare handle', () => {
    expect(buildAccountProfileUrl('tiktok', 'creator')).toBe('https://www.tiktok.com/@creator');
  });

  it('strips leading @ before re-adding it for tiktok', () => {
    expect(buildAccountProfileUrl('tiktok', '@creator')).toBe('https://www.tiktok.com/@creator');
  });

  // Instagram
  it('builds instagram URL from bare handle', () => {
    expect(buildAccountProfileUrl('instagram', 'creator')).toBe('https://www.instagram.com/creator/');
  });

  it('strips leading @ from instagram handle', () => {
    expect(buildAccountProfileUrl('instagram', '@creator')).toBe('https://www.instagram.com/creator/');
  });

  it('handles hyphenated instagram handles', () => {
    expect(buildAccountProfileUrl('instagram', 'my-brand')).toBe('https://www.instagram.com/my-brand/');
  });

  it('handles underscored tiktok handles', () => {
    expect(buildAccountProfileUrl('tiktok', 'my_creator')).toBe('https://www.tiktok.com/@my_creator');
  });

  it('handles numeric youtube handle', () => {
    expect(buildAccountProfileUrl('youtube', 'channel123')).toBe('https://www.youtube.com/@channel123');
  });
});
