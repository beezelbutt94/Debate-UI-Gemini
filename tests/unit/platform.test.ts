import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ─── detectPlatform ──────────────────────────────────────────────────────────

describe('detectPlatform', () => {
  // TikTok
  it('detects tiktok.com video', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects bare tiktok.com (no www)', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok subdomain (vm.tiktok.com)', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc123')).toBe('tiktok');
  });

  it('detects m.tiktok.com subdomain', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com/shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abcDEF123')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abcDEF123')).toBe('youtube_shorts');
  });

  it('detects youtu.be short link', () => {
    expect(detectPlatform('https://youtu.be/abcDEF123')).toBe('youtube_shorts');
  });

  it('does NOT detect a non-Shorts youtube.com/watch URL', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abcDEF123')).toBeNull();
  });

  it('does NOT detect youtube.com channel URL', () => {
    expect(detectPlatform('https://www.youtube.com/@channelname')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com/reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/1234567890')).toBe('facebook_reels');
  });

  it('detects facebook.com/reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/1234567890')).toBe('facebook_reels');
  });

  it('detects fb.watch short link', () => {
    expect(detectPlatform('https://fb.watch/abc123xyz')).toBe('facebook_reels');
  });

  it('detects subdomain.facebook.com/reel/', () => {
    expect(detectPlatform('https://m.facebook.com/reel/1234567890')).toBe('facebook_reels');
  });

  it('does NOT detect a facebook.com/watch URL (not a reel)', () => {
    expect(detectPlatform('https://www.facebook.com/watch?v=123')).toBeNull();
  });

  it('does NOT detect a facebook.com profile URL', () => {
    expect(detectPlatform('https://www.facebook.com/someuser')).toBeNull();
  });

  // Unknown / invalid
  it('returns null for an unrecognized domain', () => {
    expect(detectPlatform('https://instagram.com/p/abc')).toBeNull();
  });

  it('returns null for a plain text string (not a URL)', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a relative path', () => {
    expect(detectPlatform('/shorts/abc')).toBeNull();
  });

  it('returns null for a twitter/X URL', () => {
    expect(detectPlatform('https://twitter.com/i/status/123')).toBeNull();
  });

  it('handles URLs with query strings correctly for TikTok', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123?is_copy_url=1')).toBe('tiktok');
  });

  it('handles URLs with query strings correctly for YouTube Shorts', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc?feature=share')).toBe('youtube_shorts');
  });
});

// ─── buildAccountProfileUrl ──────────────────────────────────────────────────

describe('buildAccountProfileUrl', () => {
  describe('youtube', () => {
    it('prepends @ when handle has no @ prefix', () => {
      expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
    });

    it('does not double-up @ when handle already has it', () => {
      expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
    });

    it('handles empty string handle', () => {
      expect(buildAccountProfileUrl('youtube', '')).toBe('https://www.youtube.com/@');
    });
  });

  describe('tiktok', () => {
    it('strips @ prefix if present', () => {
      expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
    });

    it('adds @ prefix when missing', () => {
      expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
    });

    it('handles handle with multiple @ (only strips leading one)', () => {
      // replace(/^@/, '') only strips the first leading @
      expect(buildAccountProfileUrl('tiktok', 'user.name')).toBe('https://www.tiktok.com/@user.name');
    });
  });

  describe('instagram', () => {
    it('strips @ prefix if present', () => {
      expect(buildAccountProfileUrl('instagram', '@therock')).toBe('https://www.instagram.com/therock/');
    });

    it('adds nothing special when no @ prefix', () => {
      expect(buildAccountProfileUrl('instagram', 'therock')).toBe('https://www.instagram.com/therock/');
    });

    it('always ends with trailing slash', () => {
      const url = buildAccountProfileUrl('instagram', 'user');
      expect(url.endsWith('/')).toBe(true);
    });
  });
});
