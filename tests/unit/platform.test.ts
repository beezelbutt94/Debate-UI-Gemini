import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ─────────────────────────────────────────────
// detectPlatform
// ─────────────────────────────────────────────
describe('detectPlatform()', () => {
  // ── TikTok ──────────────────────────────────
  it('detects tiktok.com video URLs', () => {
    expect(detectPlatform('https://www.tiktok.com/@creator/video/123')).toBe('tiktok');
  });

  it('detects bare tiktok.com (no www)', () => {
    expect(detectPlatform('https://tiktok.com/@creator/video/123')).toBe('tiktok');
  });

  it('detects tiktok subdomain URLs', () => {
    expect(detectPlatform('https://vm.tiktok.com/ZMkABCDEF/')).toBe('tiktok');
  });

  it('detects tiktok m. subdomain', () => {
    expect(detectPlatform('https://m.tiktok.com/@creator/video/123')).toBe('tiktok');
  });

  // ── YouTube Shorts ────────────────────────────
  it('detects youtube.com/shorts/ URLs', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('does NOT detect regular youtube.com watch URLs as shorts', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('detects youtu.be short links as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  // ── Facebook Reels ────────────────────────────
  it('detects facebook.com/reel/ URLs', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('detects facebook.com/reel without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('detects fb.watch URLs as facebook_reels', () => {
    expect(detectPlatform('https://fb.watch/abc123/')).toBe('facebook_reels');
  });

  it('does NOT detect facebook.com non-reel URLs', () => {
    expect(detectPlatform('https://www.facebook.com/profile.php?id=123')).toBeNull();
  });

  it('does NOT detect facebook.com/groups as reel', () => {
    expect(detectPlatform('https://www.facebook.com/groups/somegroup/posts/123')).toBeNull();
  });

  // ── Unrecognised URLs ─────────────────────────
  it('returns null for an Instagram URL', () => {
    expect(detectPlatform('https://www.instagram.com/p/abc123/')).toBeNull();
  });

  it('returns null for a Twitter/X URL', () => {
    expect(detectPlatform('https://x.com/user/status/123')).toBeNull();
  });

  it('returns null for a completely unrelated URL', () => {
    expect(detectPlatform('https://example.com/video')).toBeNull();
  });

  it('returns null for an invalid URL string', () => {
    expect(detectPlatform('not a url')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a bare domain with no path', () => {
    expect(detectPlatform('tiktok.com')).toBeNull();
  });

  it('handles youtube.com subdomain that has /shorts/ in path', () => {
    expect(detectPlatform('https://m.youtube.com/shorts/abc')).toBe('youtube_shorts');
  });
});

// ─────────────────────────────────────────────
// buildAccountProfileUrl
// ─────────────────────────────────────────────
describe('buildAccountProfileUrl()', () => {
  // ── YouTube ──────────────────────────────────
  it('builds a YouTube URL with @ prefix when handle already has @', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('adds @ prefix for a YouTube handle that lacks it', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('does not double-add @ for youtube handle', () => {
    expect(buildAccountProfileUrl('youtube', '@Creator')).toBe('https://www.youtube.com/@Creator');
  });

  // ── TikTok ──────────────────────────────────
  it('builds a TikTok URL, stripping existing @ prefix', () => {
    expect(buildAccountProfileUrl('tiktok', '@khaby.lame')).toBe('https://www.tiktok.com/@khaby.lame');
  });

  it('builds a TikTok URL for a handle without @', () => {
    expect(buildAccountProfileUrl('tiktok', 'khaby.lame')).toBe('https://www.tiktok.com/@khaby.lame');
  });

  it('does not double @ for TikTok', () => {
    // strip leading @, then re-add it
    expect(buildAccountProfileUrl('tiktok', '@creator')).toBe('https://www.tiktok.com/@creator');
  });

  // ── Instagram ────────────────────────────────
  it('builds an Instagram URL, stripping existing @ prefix', () => {
    expect(buildAccountProfileUrl('instagram', '@natgeo')).toBe('https://www.instagram.com/natgeo/');
  });

  it('builds an Instagram URL for a handle without @', () => {
    expect(buildAccountProfileUrl('instagram', 'natgeo')).toBe('https://www.instagram.com/natgeo/');
  });

  it('does not double @ for Instagram', () => {
    expect(buildAccountProfileUrl('instagram', '@creator')).toBe('https://www.instagram.com/creator/');
  });

  it('handles handles with dots and underscores', () => {
    expect(buildAccountProfileUrl('instagram', 'my.creator_account')).toBe(
      'https://www.instagram.com/my.creator_account/'
    );
  });
});
