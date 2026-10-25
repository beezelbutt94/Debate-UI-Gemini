import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ─── detectPlatform ──────────────────────────────────────────────────────────

describe('detectPlatform()', () => {
  // ── TikTok ──────────────────────────────────────────────────────────────────
  describe('TikTok', () => {
    it('detects plain tiktok.com video URL', () => {
      expect(detectPlatform('https://www.tiktok.com/@user/video/1234567890')).toBe('tiktok');
    });

    it('detects tiktok.com without www', () => {
      expect(detectPlatform('https://tiktok.com/@user/video/1234567890')).toBe('tiktok');
    });

    it('detects mobile subdomain m.tiktok.com', () => {
      expect(detectPlatform('https://m.tiktok.com/@user/video/1234567890')).toBe('tiktok');
    });

    it('detects arbitrary tiktok subdomain', () => {
      expect(detectPlatform('https://vm.tiktok.com/abcd/')).toBe('tiktok');
    });

    it('detects tiktok profile URLs', () => {
      expect(detectPlatform('https://www.tiktok.com/@creator')).toBe('tiktok');
    });
  });

  // ── YouTube Shorts ───────────────────────────────────────────────────────────
  describe('YouTube Shorts', () => {
    it('detects youtube.com/shorts/ URL', () => {
      expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
    });

    it('detects youtube.com/shorts/ without www', () => {
      expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
    });

    it('detects m.youtube.com/shorts/', () => {
      expect(detectPlatform('https://m.youtube.com/shorts/abc123')).toBe('youtube_shorts');
    });

    it('detects youtu.be short link', () => {
      expect(detectPlatform('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube_shorts');
    });

    it('does NOT detect regular youtube.com watch URL as shorts', () => {
      expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
    });

    it('does NOT detect youtube.com channel URL as shorts', () => {
      expect(detectPlatform('https://www.youtube.com/@channel')).toBeNull();
    });
  });

  // ── Facebook Reels ───────────────────────────────────────────────────────────
  describe('Facebook Reels', () => {
    it('detects facebook.com/reel/ URL', () => {
      expect(detectPlatform('https://www.facebook.com/reel/1234567890')).toBe('facebook_reels');
    });

    it('detects facebook.com/reel/ without www', () => {
      expect(detectPlatform('https://facebook.com/reel/1234567890')).toBe('facebook_reels');
    });

    it('detects m.facebook.com/reel/', () => {
      expect(detectPlatform('https://m.facebook.com/reel/1234567890')).toBe('facebook_reels');
    });

    it('detects fb.watch short link', () => {
      expect(detectPlatform('https://fb.watch/abcdef/')).toBe('facebook_reels');
    });

    it('does NOT detect plain facebook.com post as reels', () => {
      expect(detectPlatform('https://www.facebook.com/some/post')).toBeNull();
    });

    it('does NOT detect facebook.com profile as reels', () => {
      expect(detectPlatform('https://www.facebook.com/username')).toBeNull();
    });
  });

  // ── Invalid / Unrecognised ───────────────────────────────────────────────────
  describe('Invalid / Unrecognised URLs', () => {
    it('returns null for a completely invalid string', () => {
      expect(detectPlatform('not-a-url')).toBeNull();
    });

    it('returns null for an empty string', () => {
      expect(detectPlatform('')).toBeNull();
    });

    it('returns null for a Twitter/X URL', () => {
      expect(detectPlatform('https://twitter.com/i/status/123')).toBeNull();
    });

    it('returns null for Instagram URL', () => {
      expect(detectPlatform('https://www.instagram.com/reel/abc/')).toBeNull();
    });

    it('returns null for a generic https URL', () => {
      expect(detectPlatform('https://example.com/video')).toBeNull();
    });

    it('detects tiktok host even with ftp scheme (scheme is not checked)', () => {
      // The function only validates the hostname, not the URL scheme.
      expect(detectPlatform('ftp://tiktok.com/video')).toBe('tiktok');
    });

    it('returns null for bare domain without scheme', () => {
      expect(detectPlatform('tiktok.com/video')).toBeNull();
    });

    it('returns null for URL with tiktok in path but wrong host', () => {
      expect(detectPlatform('https://example.com/tiktok/video')).toBeNull();
    });
  });
});

// ─── buildAccountProfileUrl ──────────────────────────────────────────────────

describe('buildAccountProfileUrl()', () => {
  // ── YouTube ──────────────────────────────────────────────────────────────────
  describe('youtube', () => {
    it('prepends @ when handle has no @', () => {
      expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe(
        'https://www.youtube.com/@MrBeast'
      );
    });

    it('does not double @ when handle already starts with @', () => {
      expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe(
        'https://www.youtube.com/@MrBeast'
      );
    });

    it('handles mixed case handle', () => {
      expect(buildAccountProfileUrl('youtube', 'MyChannel123')).toBe(
        'https://www.youtube.com/@MyChannel123'
      );
    });
  });

  // ── TikTok ───────────────────────────────────────────────────────────────────
  describe('tiktok', () => {
    it('builds correct URL when handle has no @', () => {
      expect(buildAccountProfileUrl('tiktok', 'creator')).toBe(
        'https://www.tiktok.com/@creator'
      );
    });

    it('strips leading @ before adding it back', () => {
      expect(buildAccountProfileUrl('tiktok', '@creator')).toBe(
        'https://www.tiktok.com/@creator'
      );
    });

    it('handles handles with dots and underscores', () => {
      expect(buildAccountProfileUrl('tiktok', 'my.creator_handle')).toBe(
        'https://www.tiktok.com/@my.creator_handle'
      );
    });
  });

  // ── Instagram ────────────────────────────────────────────────────────────────
  describe('instagram', () => {
    it('builds correct URL when handle has no @', () => {
      expect(buildAccountProfileUrl('instagram', 'myprofile')).toBe(
        'https://www.instagram.com/myprofile/'
      );
    });

    it('strips leading @ before building URL', () => {
      expect(buildAccountProfileUrl('instagram', '@myprofile')).toBe(
        'https://www.instagram.com/myprofile/'
      );
    });

    it('trailing slash is included', () => {
      const url = buildAccountProfileUrl('instagram', 'creator');
      expect(url.endsWith('/')).toBe(true);
    });
  });
});
