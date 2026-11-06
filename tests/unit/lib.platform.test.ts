import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ─── detectPlatform ───────────────────────────────────────────────────────────

describe('detectPlatform()', () => {
  // ── TikTok ──
  it('detects tiktok.com video', () => {
    expect(detectPlatform('https://www.tiktok.com/@creator/video/1234567890')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@handle/video/999')).toBe('tiktok');
  });

  it('detects subdomain of tiktok.com', () => {
    expect(detectPlatform('https://vm.tiktok.com/xyz')).toBe('tiktok');
  });

  // ── YouTube Shorts ──
  it('detects youtube.com /shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com /shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/xyz')).toBe('youtube_shorts');
  });

  it('does NOT detect youtube.com without /shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('detects youtu.be as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  // ── Facebook Reels ──
  it('detects facebook.com /reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects facebook.com /reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/789')).toBe('facebook_reels');
  });

  it('detects fb.watch URL', () => {
    expect(detectPlatform('https://fb.watch/abc123/')).toBe('facebook_reels');
  });

  it('does NOT detect facebook.com without /reel/', () => {
    expect(detectPlatform('https://www.facebook.com/someuser/posts/123')).toBeNull();
  });

  // ── Unrecognised ──
  it('returns null for an Instagram URL', () => {
    expect(detectPlatform('https://www.instagram.com/p/abc123/')).toBeNull();
  });

  it('returns null for an arbitrary URL', () => {
    expect(detectPlatform('https://example.com/video')).toBeNull();
  });

  it('returns null for a completely invalid string', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a bare domain with no path', () => {
    expect(detectPlatform('https://vimeo.com/123456')).toBeNull();
  });

  // ── Additional edge cases ──
  it('detects mobile youtube shorts (m.youtube.com/shorts/)', () => {
    expect(detectPlatform('https://m.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects fb.watch without trailing slash', () => {
    expect(detectPlatform('https://fb.watch/abc123')).toBe('facebook_reels');
  });

  it('detects tiktok URL with query params', () => {
    expect(detectPlatform('https://www.tiktok.com/@creator/video/123?referrer=share')).toBe('tiktok');
  });

  it('detects facebook reel with query params', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123?s=5')).toBe('facebook_reels');
  });

  it('returns null for a Vimeo URL', () => {
    expect(detectPlatform('https://vimeo.com/channels/shorts/123')).toBeNull();
  });

  it('returns null for a URL that only contains the word "tiktok" in the path', () => {
    expect(detectPlatform('https://example.com/tiktok/video')).toBeNull();
  });
});

// ─── buildAccountProfileUrl ───────────────────────────────────────────────────

describe('buildAccountProfileUrl()', () => {
  // ── YouTube ──
  it('builds youtube URL for a bare handle', () => {
    expect(buildAccountProfileUrl('youtube', 'creator')).toBe('https://www.youtube.com/@creator');
  });

  it('does not double-add @ for youtube when handle already starts with @', () => {
    expect(buildAccountProfileUrl('youtube', '@creator')).toBe('https://www.youtube.com/@creator');
  });

  // ── TikTok ──
  it('builds tiktok URL for a bare handle', () => {
    expect(buildAccountProfileUrl('tiktok', 'creator')).toBe('https://www.tiktok.com/@creator');
  });

  it('does not double-add @ for tiktok when handle already starts with @', () => {
    expect(buildAccountProfileUrl('tiktok', '@creator')).toBe('https://www.tiktok.com/@creator');
  });

  // ── Instagram ──
  it('builds instagram URL for a bare handle', () => {
    expect(buildAccountProfileUrl('instagram', 'creator')).toBe('https://www.instagram.com/creator/');
  });

  it('strips leading @ for instagram', () => {
    expect(buildAccountProfileUrl('instagram', '@creator')).toBe('https://www.instagram.com/creator/');
  });

  it('handles handles with underscores', () => {
    expect(buildAccountProfileUrl('tiktok', 'my_creator_handle')).toBe('https://www.tiktok.com/@my_creator_handle');
  });

  it('handles handles with dots', () => {
    expect(buildAccountProfileUrl('youtube', 'my.creator')).toBe('https://www.youtube.com/@my.creator');
  });

  it('handles handles with numbers', () => {
    expect(buildAccountProfileUrl('tiktok', 'creator123')).toBe('https://www.tiktok.com/@creator123');
  });

  it('handles a handle that is only @', () => {
    expect(buildAccountProfileUrl('youtube', '@')).toBe('https://www.youtube.com/@');
  });

  it('youtube – handle with multiple @ symbols only strips one leading @', () => {
    // The function only checks startsWith('@'), not multiple; second @ stays in the path
    expect(buildAccountProfileUrl('youtube', '@@creator')).toBe('https://www.youtube.com/@@creator');
  });

  it('instagram – handle with numbers and underscores', () => {
    expect(buildAccountProfileUrl('instagram', 'my_handle_42')).toBe('https://www.instagram.com/my_handle_42/');
  });
});
