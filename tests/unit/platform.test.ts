import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform', () => {
  // TikTok cases
  describe('TikTok', () => {
    it('detects tiktok.com URL', () => {
      expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
    });

    it('detects tiktok.com without www', () => {
      expect(detectPlatform('https://tiktok.com/@user/video/456')).toBe('tiktok');
    });

    it('detects TikTok subdomain', () => {
      expect(detectPlatform('https://vm.tiktok.com/abc123/')).toBe('tiktok');
    });

    it('detects TikTok mobile subdomain', () => {
      expect(detectPlatform('https://m.tiktok.com/@user/video/789')).toBe('tiktok');
    });
  });

  // YouTube Shorts cases
  describe('YouTube Shorts', () => {
    it('detects youtube.com /shorts/ URL', () => {
      expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
    });

    it('detects youtube.com /shorts/ without www', () => {
      expect(detectPlatform('https://youtube.com/shorts/xyz')).toBe('youtube_shorts');
    });

    it('detects youtu.be short URL', () => {
      expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
    });

    it('does NOT detect regular youtube.com video (not /shorts/)', () => {
      expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
    });

    it('does NOT detect youtube.com channel page', () => {
      expect(detectPlatform('https://www.youtube.com/@channelname')).toBeNull();
    });

    it('detects youtube subdomain with /shorts/', () => {
      expect(detectPlatform('https://m.youtube.com/shorts/abc123')).toBe('youtube_shorts');
    });
  });

  // Facebook Reels cases
  describe('Facebook Reels', () => {
    it('detects facebook.com /reel/ URL', () => {
      expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
    });

    it('detects facebook.com /reel/ without www', () => {
      expect(detectPlatform('https://facebook.com/reel/789')).toBe('facebook_reels');
    });

    it('detects fb.watch URL', () => {
      expect(detectPlatform('https://fb.watch/abc123/')).toBe('facebook_reels');
    });

    it('does NOT detect regular facebook.com post (no /reel/)', () => {
      expect(detectPlatform('https://www.facebook.com/someuser/posts/123')).toBeNull();
    });

    it('does NOT detect facebook.com profile page', () => {
      expect(detectPlatform('https://www.facebook.com/someuser')).toBeNull();
    });

    it('detects facebook subdomain with /reel/', () => {
      expect(detectPlatform('https://m.facebook.com/reel/999')).toBe('facebook_reels');
    });
  });

  // Invalid/unknown cases
  describe('unknown / invalid inputs', () => {
    it('returns null for Instagram URL', () => {
      expect(detectPlatform('https://www.instagram.com/p/abc123')).toBeNull();
    });

    it('returns null for Twitter/X URL', () => {
      expect(detectPlatform('https://twitter.com/user/status/123')).toBeNull();
    });

    it('returns null for a plain string (not a URL)', () => {
      expect(detectPlatform('not a url')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(detectPlatform('')).toBeNull();
    });

    it('returns null for a random domain', () => {
      expect(detectPlatform('https://example.com/video/123')).toBeNull();
    });

    it('returns null for a malformed URL with only a protocol', () => {
      expect(detectPlatform('https://')).toBeNull();
    });

    it('returns null for HTTP vs HTTPS (still valid URL, still unknown domain)', () => {
      expect(detectPlatform('http://example.com')).toBeNull();
    });

    it('returns null for a URL that looks like tiktok in path only', () => {
      expect(detectPlatform('https://example.com/tiktok.com/video')).toBeNull();
    });
  });
});

describe('buildAccountProfileUrl', () => {
  describe('youtube', () => {
    it('prefixes handle with @ if not already present', () => {
      expect(buildAccountProfileUrl('youtube', 'channelname')).toBe(
        'https://www.youtube.com/@channelname'
      );
    });

    it('does not double-add @ when already present', () => {
      expect(buildAccountProfileUrl('youtube', '@channelname')).toBe(
        'https://www.youtube.com/@channelname'
      );
    });

    it('handles handles with numbers', () => {
      expect(buildAccountProfileUrl('youtube', 'channel123')).toBe(
        'https://www.youtube.com/@channel123'
      );
    });

    it('handles handles with underscores', () => {
      expect(buildAccountProfileUrl('youtube', 'my_channel')).toBe(
        'https://www.youtube.com/@my_channel'
      );
    });
  });

  describe('tiktok', () => {
    it('strips leading @ before building URL', () => {
      expect(buildAccountProfileUrl('tiktok', '@username')).toBe(
        'https://www.tiktok.com/@username'
      );
    });

    it('adds @ when not present', () => {
      expect(buildAccountProfileUrl('tiktok', 'username')).toBe(
        'https://www.tiktok.com/@username'
      );
    });

    it('handles handles with dots', () => {
      expect(buildAccountProfileUrl('tiktok', 'my.user')).toBe(
        'https://www.tiktok.com/@my.user'
      );
    });
  });

  describe('instagram', () => {
    it('strips leading @ before building URL', () => {
      expect(buildAccountProfileUrl('instagram', '@profile')).toBe(
        'https://www.instagram.com/profile/'
      );
    });

    it('adds trailing slash when handle has no @', () => {
      expect(buildAccountProfileUrl('instagram', 'profile')).toBe(
        'https://www.instagram.com/profile/'
      );
    });

    it('handles handles with underscores', () => {
      expect(buildAccountProfileUrl('instagram', 'my_profile')).toBe(
        'https://www.instagram.com/my_profile/'
      );
    });
  });
});
