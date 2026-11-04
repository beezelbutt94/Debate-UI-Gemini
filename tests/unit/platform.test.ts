import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ─── detectPlatform ─────────────────────────────────────────────────────────

describe('detectPlatform()', () => {
  // ── TikTok ────────────────────────────────────────────────────────────────
  describe('TikTok', () => {
    it('detects standard tiktok.com video URL', () => {
      expect(detectPlatform('https://www.tiktok.com/@creator/video/7351234567890')).toBe('tiktok');
    });

    it('detects tiktok.com without www', () => {
      expect(detectPlatform('https://tiktok.com/@creator/video/123')).toBe('tiktok');
    });

    it('detects tiktok short-link subdomain (vm.tiktok.com)', () => {
      expect(detectPlatform('https://vm.tiktok.com/ZMexample/')).toBe('tiktok');
    });

    it('detects tiktok mobile subdomain (m.tiktok.com)', () => {
      expect(detectPlatform('https://m.tiktok.com/@creator/video/123')).toBe('tiktok');
    });

    it('detects TikTok URL with query parameters', () => {
      expect(detectPlatform('https://www.tiktok.com/@creator/video/123?lang=en')).toBe('tiktok');
    });
  });

  // ── YouTube Shorts ─────────────────────────────────────────────────────────
  describe('YouTube Shorts', () => {
    it('detects youtube.com/shorts/ URL', () => {
      expect(detectPlatform('https://www.youtube.com/shorts/abcDEFgh')).toBe('youtube_shorts');
    });

    it('detects youtube.com/shorts/ without www', () => {
      expect(detectPlatform('https://youtube.com/shorts/abcDEFgh')).toBe('youtube_shorts');
    });

    it('detects youtu.be short link', () => {
      expect(detectPlatform('https://youtu.be/abcDEFghijk')).toBe('youtube_shorts');
    });

    it('returns null for a standard YouTube watch URL (not a Short)', () => {
      expect(detectPlatform('https://www.youtube.com/watch?v=abc')).toBeNull();
    });

    it('returns null for youtube.com channel URL', () => {
      expect(detectPlatform('https://www.youtube.com/@channel')).toBeNull();
    });

    it('returns null for youtube.com playlist URL', () => {
      expect(detectPlatform('https://www.youtube.com/playlist?list=PLabc')).toBeNull();
    });
  });

  // ── Facebook Reels ─────────────────────────────────────────────────────────
  describe('Facebook Reels', () => {
    it('detects facebook.com/reel/ URL', () => {
      expect(detectPlatform('https://www.facebook.com/reel/1234567890')).toBe('facebook_reels');
    });

    it('detects facebook.com/reel/ without www', () => {
      expect(detectPlatform('https://facebook.com/reel/1234567890')).toBe('facebook_reels');
    });

    it('detects fb.watch short link', () => {
      expect(detectPlatform('https://fb.watch/xyzABC')).toBe('facebook_reels');
    });

    it('detects facebook subdomain with /reel/', () => {
      expect(detectPlatform('https://m.facebook.com/reel/999')).toBe('facebook_reels');
    });

    it('returns null for a facebook.com post that is not a reel', () => {
      expect(detectPlatform('https://www.facebook.com/someone/posts/123')).toBeNull();
    });

    it('returns null for facebook.com photo URL', () => {
      expect(detectPlatform('https://www.facebook.com/photo?fbid=123')).toBeNull();
    });
  });

  // ── Unsupported / invalid ──────────────────────────────────────────────────
  describe('unsupported and invalid inputs', () => {
    it('returns null for a plain string (not a URL)', () => {
      expect(detectPlatform('not-a-url')).toBeNull();
    });

    it('returns null for an empty string', () => {
      expect(detectPlatform('')).toBeNull();
    });

    it('returns null for Instagram URL', () => {
      expect(detectPlatform('https://www.instagram.com/p/abc123/')).toBeNull();
    });

    it('returns null for Twitter/X URL', () => {
      expect(detectPlatform('https://twitter.com/i/status/123')).toBeNull();
    });

    it('returns null for a random website URL', () => {
      expect(detectPlatform('https://example.com/video/123')).toBeNull();
    });

    it('returns null for URL with no host', () => {
      expect(detectPlatform('ftp://')).toBeNull();
    });

    it('returns null for Snapchat spotlight URL', () => {
      expect(detectPlatform('https://www.snapchat.com/spotlight/abc123')).toBeNull();
    });

    it('returns null for LinkedIn video URL', () => {
      expect(detectPlatform('https://www.linkedin.com/feed/update/urn:li:ugcPost:123')).toBeNull();
    });
  });
});

// ─── buildAccountProfileUrl ───────────────────────────────────────────────

describe('buildAccountProfileUrl()', () => {
  // ── YouTube ────────────────────────────────────────────────────────────────
  describe('youtube', () => {
    it('prepends @ when handle does not start with @', () => {
      expect(buildAccountProfileUrl('youtube', 'mychannel')).toBe('https://www.youtube.com/@mychannel');
    });

    it('does not double-prefix @ when handle already starts with @', () => {
      expect(buildAccountProfileUrl('youtube', '@mychannel')).toBe('https://www.youtube.com/@mychannel');
    });

    it('handles handles with numbers', () => {
      expect(buildAccountProfileUrl('youtube', 'channel123')).toBe('https://www.youtube.com/@channel123');
    });

    it('handles handles with hyphens', () => {
      expect(buildAccountProfileUrl('youtube', 'my-channel')).toBe('https://www.youtube.com/@my-channel');
    });
  });

  // ── TikTok ────────────────────────────────────────────────────────────────
  describe('tiktok', () => {
    it('strips leading @ before building URL', () => {
      expect(buildAccountProfileUrl('tiktok', '@creator')).toBe('https://www.tiktok.com/@creator');
    });

    it('adds @ when handle does not start with @', () => {
      expect(buildAccountProfileUrl('tiktok', 'creator')).toBe('https://www.tiktok.com/@creator');
    });

    it('handles handles with dots', () => {
      expect(buildAccountProfileUrl('tiktok', 'my.creator')).toBe('https://www.tiktok.com/@my.creator');
    });
  });

  // ── Instagram ─────────────────────────────────────────────────────────────
  describe('instagram', () => {
    it('strips leading @ before building URL', () => {
      expect(buildAccountProfileUrl('instagram', '@influencer')).toBe('https://www.instagram.com/influencer/');
    });

    it('adds trailing slash when handle does not start with @', () => {
      expect(buildAccountProfileUrl('instagram', 'influencer')).toBe('https://www.instagram.com/influencer/');
    });

    it('handles handles with underscores', () => {
      expect(buildAccountProfileUrl('instagram', 'my_account')).toBe('https://www.instagram.com/my_account/');
    });

    it('handles handles with dots', () => {
      expect(buildAccountProfileUrl('instagram', 'my.account')).toBe('https://www.instagram.com/my.account/');
    });
  });
});
