import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform()', () => {
  // ── TikTok ──────────────────────────────────────────────────────────────
  describe('TikTok', () => {
    it('detects a standard tiktok.com video URL', () => {
      expect(detectPlatform('https://www.tiktok.com/@user/video/1234567890')).toBe('tiktok');
    });

    it('detects a tiktok.com URL without www', () => {
      expect(detectPlatform('https://tiktok.com/@user/video/1234567890')).toBe('tiktok');
    });

    it('detects a mobile tiktok subdomain', () => {
      expect(detectPlatform('https://m.tiktok.com/@user/video/1234567890')).toBe('tiktok');
    });

    it('detects a tiktok profile URL (no video path)', () => {
      expect(detectPlatform('https://www.tiktok.com/@someone')).toBe('tiktok');
    });
  });

  // ── YouTube Shorts ───────────────────────────────────────────────────────
  describe('YouTube Shorts', () => {
    it('detects a youtube.com/shorts/ URL', () => {
      expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
    });

    it('detects a youtube.com/shorts/ URL without www', () => {
      expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
    });

    it('detects a mobile youtube subdomain with /shorts/', () => {
      expect(detectPlatform('https://m.youtube.com/shorts/abc123')).toBe('youtube_shorts');
    });

    it('detects a youtu.be short URL', () => {
      expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
    });

    it('returns null for a regular YouTube watch URL', () => {
      expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
    });

    it('returns null for youtube.com without /shorts/', () => {
      expect(detectPlatform('https://www.youtube.com/channel/UCxxx')).toBeNull();
    });
  });

  // ── Facebook Reels ───────────────────────────────────────────────────────
  describe('Facebook Reels', () => {
    it('detects a facebook.com/reel/ URL', () => {
      expect(detectPlatform('https://www.facebook.com/reel/1234567890')).toBe('facebook_reels');
    });

    it('detects a facebook.com/reel/ URL without www', () => {
      expect(detectPlatform('https://facebook.com/reel/1234567890')).toBe('facebook_reels');
    });

    it('detects fb.watch short URLs', () => {
      expect(detectPlatform('https://fb.watch/abcXYZ')).toBe('facebook_reels');
    });

    it('returns null for a facebook.com URL that is not a reel', () => {
      expect(detectPlatform('https://www.facebook.com/someone/posts/123')).toBeNull();
    });
  });

  // ── Unsupported / invalid ────────────────────────────────────────────────
  describe('unsupported URLs', () => {
    it('returns null for an Instagram URL', () => {
      expect(detectPlatform('https://www.instagram.com/p/abc/')).toBeNull();
    });

    it('returns null for an arbitrary URL', () => {
      expect(detectPlatform('https://example.com/video/123')).toBeNull();
    });

    it('returns null for a non-URL string', () => {
      expect(detectPlatform('not-a-url')).toBeNull();
    });

    it('returns null for an empty string', () => {
      expect(detectPlatform('')).toBeNull();
    });

    it('returns null for a bare domain with no scheme', () => {
      expect(detectPlatform('tiktok.com/@user/video/1')).toBeNull();
    });
  });
});

describe('buildAccountProfileUrl()', () => {
  // ── YouTube ──────────────────────────────────────────────────────────────
  describe('youtube', () => {
    it('adds @ prefix when handle has no @', () => {
      expect(buildAccountProfileUrl('youtube', 'myChannel')).toBe('https://www.youtube.com/@myChannel');
    });

    it('preserves @ prefix when handle already has it', () => {
      expect(buildAccountProfileUrl('youtube', '@myChannel')).toBe('https://www.youtube.com/@myChannel');
    });

    it('handles handles with numbers and underscores', () => {
      const url = buildAccountProfileUrl('youtube', 'my_channel_123');
      expect(url).toBe('https://www.youtube.com/@my_channel_123');
    });
  });

  // ── TikTok ───────────────────────────────────────────────────────────────
  describe('tiktok', () => {
    it('strips leading @ and prepends @', () => {
      expect(buildAccountProfileUrl('tiktok', '@tiktokUser')).toBe('https://www.tiktok.com/@tiktokUser');
    });

    it('adds @ when handle has none', () => {
      expect(buildAccountProfileUrl('tiktok', 'tiktokUser')).toBe('https://www.tiktok.com/@tiktokUser');
    });
  });

  // ── Instagram ────────────────────────────────────────────────────────────
  describe('instagram', () => {
    it('strips leading @ and builds profile URL', () => {
      expect(buildAccountProfileUrl('instagram', '@instaUser')).toBe('https://www.instagram.com/instaUser/');
    });

    it('builds profile URL when handle has no @', () => {
      expect(buildAccountProfileUrl('instagram', 'instaUser')).toBe('https://www.instagram.com/instaUser/');
    });

    it('trailing slash is always present', () => {
      const url = buildAccountProfileUrl('instagram', 'someone');
      expect(url.endsWith('/')).toBe(true);
    });
  });
});
