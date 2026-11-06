import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform', () => {
  describe('TikTok', () => {
    it('detects plain tiktok.com URL', () => {
      expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
    });

    it('detects tiktok.com without www', () => {
      expect(detectPlatform('https://tiktok.com/@creator')).toBe('tiktok');
    });

    it('detects subdomain of tiktok.com', () => {
      expect(detectPlatform('https://vm.tiktok.com/abc123')).toBe('tiktok');
    });

    it('detects m.tiktok.com', () => {
      expect(detectPlatform('https://m.tiktok.com/@user/video/999')).toBe('tiktok');
    });
  });

  describe('YouTube Shorts', () => {
    it('detects youtube.com /shorts/ URL', () => {
      expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
    });

    it('detects youtube.com /shorts/ without www', () => {
      expect(detectPlatform('https://youtube.com/shorts/xyz')).toBe('youtube_shorts');
    });

    it('detects youtu.be short URL', () => {
      expect(detectPlatform('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube_shorts');
    });

    it('returns null for youtube.com non-shorts URL', () => {
      expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
    });

    it('returns null for youtube.com channel URL', () => {
      expect(detectPlatform('https://www.youtube.com/@channel')).toBeNull();
    });
  });

  describe('Facebook Reels', () => {
    it('detects facebook.com /reel/ URL', () => {
      expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
    });

    it('detects facebook.com /reel/ without www', () => {
      expect(detectPlatform('https://facebook.com/reel/789')).toBe('facebook_reels');
    });

    it('detects fb.watch URL', () => {
      expect(detectPlatform('https://fb.watch/abc123')).toBe('facebook_reels');
    });

    it('detects subdomain facebook.com with /reel/', () => {
      expect(detectPlatform('https://m.facebook.com/reel/123')).toBe('facebook_reels');
    });

    it('returns null for facebook.com non-reel URL', () => {
      expect(detectPlatform('https://www.facebook.com/username/videos/123')).toBeNull();
    });
  });

  describe('Invalid / unknown URLs', () => {
    it('returns null for a non-matching domain', () => {
      expect(detectPlatform('https://instagram.com/p/abc123')).toBeNull();
    });

    it('returns null for a plain string', () => {
      expect(detectPlatform('not-a-url')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(detectPlatform('')).toBeNull();
    });

    it('returns null for a Twitter/X URL', () => {
      expect(detectPlatform('https://twitter.com/user/status/123')).toBeNull();
    });

    it('returns null for a Vimeo URL', () => {
      expect(detectPlatform('https://vimeo.com/123456789')).toBeNull();
    });

    it('returns null for a random string without protocol', () => {
      expect(detectPlatform('tiktok.com/@user')).toBeNull();
    });
  });
});

describe('buildAccountProfileUrl', () => {
  describe('youtube', () => {
    it('prepends @ when handle has no @', () => {
      expect(buildAccountProfileUrl('youtube', 'mychannel')).toBe('https://www.youtube.com/@mychannel');
    });

    it('keeps existing @ prefix', () => {
      expect(buildAccountProfileUrl('youtube', '@mychannel')).toBe('https://www.youtube.com/@mychannel');
    });

    it('handles handle with numbers', () => {
      expect(buildAccountProfileUrl('youtube', 'channel123')).toBe('https://www.youtube.com/@channel123');
    });
  });

  describe('tiktok', () => {
    it('strips leading @ before constructing URL', () => {
      expect(buildAccountProfileUrl('tiktok', '@creator')).toBe('https://www.tiktok.com/@creator');
    });

    it('adds @ for handle without it', () => {
      expect(buildAccountProfileUrl('tiktok', 'creator')).toBe('https://www.tiktok.com/@creator');
    });

    it('handles handle that starts with no @', () => {
      expect(buildAccountProfileUrl('tiktok', 'username123')).toBe('https://www.tiktok.com/@username123');
    });
  });

  describe('instagram', () => {
    it('strips leading @ before constructing URL', () => {
      expect(buildAccountProfileUrl('instagram', '@influencer')).toBe('https://www.instagram.com/influencer/');
    });

    it('handles handle without @', () => {
      expect(buildAccountProfileUrl('instagram', 'influencer')).toBe('https://www.instagram.com/influencer/');
    });

    it('handles trailing slash in result', () => {
      const url = buildAccountProfileUrl('instagram', 'user');
      expect(url.endsWith('/')).toBe(true);
    });
  });
});
