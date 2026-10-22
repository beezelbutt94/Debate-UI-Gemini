import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform', () => {
  // ── TikTok ────────────────────────────────────────────────────────────────
  it('detects tiktok.com URLs', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects bare tiktok.com (no www)', () => {
    expect(detectPlatform('https://tiktok.com/@creator')).toBe('tiktok');
  });

  it('detects tiktok subdomains (e.g. m.tiktok.com)', () => {
    expect(detectPlatform('https://m.tiktok.com/@creator/video/999')).toBe('tiktok');
  });

  // ── YouTube Shorts ─────────────────────────────────────────────────────────
  it('detects youtube.com/shorts/ URLs', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/xyz')).toBe('youtube_shorts');
  });

  it('detects youtu.be URLs', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('does NOT match youtube.com without /shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc')).toBeNull();
  });

  // ── Facebook Reels ─────────────────────────────────────────────────────────
  it('detects facebook.com/reel/ URLs', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects facebook.com/reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/abc')).toBe('facebook_reels');
  });

  it('detects fb.watch URLs', () => {
    expect(detectPlatform('https://fb.watch/abc123')).toBe('facebook_reels');
  });

  it('does NOT match facebook.com without /reel/', () => {
    expect(detectPlatform('https://www.facebook.com/photo/123')).toBeNull();
  });

  it('does NOT match facebook subdomain without /reel/', () => {
    expect(detectPlatform('https://m.facebook.com/posts/123')).toBeNull();
  });

  // ── Unknown / invalid ──────────────────────────────────────────────────────
  it('returns null for an unrecognised domain', () => {
    expect(detectPlatform('https://instagram.com/p/abc')).toBeNull();
  });

  it('returns null for a completely invalid URL', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a plain string without protocol', () => {
    expect(detectPlatform('tiktok.com/@user')).toBeNull();
  });
});

describe('buildAccountProfileUrl', () => {
  // ── YouTube ────────────────────────────────────────────────────────────────
  it('prefixes @ when not present for YouTube', () => {
    expect(buildAccountProfileUrl('youtube', 'mychannel')).toBe(
      'https://www.youtube.com/@mychannel'
    );
  });

  it('does not double-prefix @ for YouTube', () => {
    expect(buildAccountProfileUrl('youtube', '@mychannel')).toBe(
      'https://www.youtube.com/@mychannel'
    );
  });

  // ── TikTok ─────────────────────────────────────────────────────────────────
  it('strips leading @ before adding it back for TikTok', () => {
    expect(buildAccountProfileUrl('tiktok', '@creator')).toBe(
      'https://www.tiktok.com/@creator'
    );
  });

  it('adds @ when missing for TikTok', () => {
    expect(buildAccountProfileUrl('tiktok', 'creator')).toBe(
      'https://www.tiktok.com/@creator'
    );
  });

  // ── Instagram ──────────────────────────────────────────────────────────────
  it('strips leading @ for Instagram', () => {
    expect(buildAccountProfileUrl('instagram', '@influencer')).toBe(
      'https://www.instagram.com/influencer/'
    );
  });

  it('keeps handle as-is (no @) for Instagram', () => {
    expect(buildAccountProfileUrl('instagram', 'influencer')).toBe(
      'https://www.instagram.com/influencer/'
    );
  });
});
