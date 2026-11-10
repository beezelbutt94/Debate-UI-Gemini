import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ─── detectPlatform ───────────────────────────────────────────────────────────

describe('detectPlatform', () => {
  // TikTok
  it('detects bare tiktok.com URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok subdomain', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com /shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com without www when it has /shorts/', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube subdomain with /shorts/', () => {
    expect(detectPlatform('https://m.youtube.com/shorts/xyz')).toBe('youtube_shorts');
  });

  it('detects youtu.be as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('returns null for plain youtube.com watch URL (not shorts)', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com /reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects facebook.com without www with /reel/', () => {
    expect(detectPlatform('https://facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects fb.watch URL', () => {
    expect(detectPlatform('https://fb.watch/xyzabc/')).toBe('facebook_reels');
  });

  it('returns null for facebook.com without /reel/', () => {
    expect(detectPlatform('https://www.facebook.com/someuser/posts/123')).toBeNull();
  });

  // Edge / unknown
  it('returns null for an unknown domain', () => {
    expect(detectPlatform('https://instagram.com/p/abc')).toBeNull();
  });

  it('returns null for a completely invalid string', () => {
    expect(detectPlatform('not a url at all')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a bare domain with no path', () => {
    expect(detectPlatform('https://example.com')).toBeNull();
  });

  it('returns null for an almost-tiktok domain (tiktok.com.evil.com)', () => {
    expect(detectPlatform('https://tiktok.com.evil.com/video/123')).toBeNull();
  });
});

// ─── buildAccountProfileUrl ───────────────────────────────────────────────────

describe('buildAccountProfileUrl', () => {
  // YouTube
  it('builds youtube URL for handle with @', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('builds youtube URL for handle without @ (prepends it)', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  // TikTok
  it('builds tiktok URL for handle with @', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('builds tiktok URL for handle without @ (strips it correctly)', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('strips exactly one leading @ from tiktok handles (replace is not recursive)', () => {
    // handle.replace(/^@/, '') strips only the first @.
    // @@double → @double → prepend @ → @@double (real behavior).
    expect(buildAccountProfileUrl('tiktok', '@@double')).toBe('https://www.tiktok.com/@@double');
  });

  // Instagram
  it('builds instagram URL for handle with @', () => {
    expect(buildAccountProfileUrl('instagram', '@someuser')).toBe('https://www.instagram.com/someuser/');
  });

  it('builds instagram URL for handle without @', () => {
    expect(buildAccountProfileUrl('instagram', 'someuser')).toBe('https://www.instagram.com/someuser/');
  });

  it('instagram URL always has trailing slash', () => {
    const url = buildAccountProfileUrl('instagram', 'user');
    expect(url.endsWith('/')).toBe(true);
  });

  it('youtube URL preserves handle capitalisation', () => {
    expect(buildAccountProfileUrl('youtube', 'CaseyNeistat')).toBe('https://www.youtube.com/@CaseyNeistat');
  });
});
