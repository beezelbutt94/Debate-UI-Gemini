import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ---------------------------------------------------------------------------
// detectPlatform
// ---------------------------------------------------------------------------

describe('detectPlatform', () => {
  // TikTok
  it('identifies tiktok.com URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('identifies tiktok.com URL without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/456')).toBe('tiktok');
  });

  it('identifies tiktok subdomain (e.g. m.tiktok.com)', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/789')).toBe('tiktok');
  });

  // YouTube Shorts
  it('identifies youtube.com /shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('identifies youtube.com /shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('identifies youtu.be short URL as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('returns null for youtube.com watch URL (not Shorts)', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('returns null for youtube.com channel URL', () => {
    expect(detectPlatform('https://www.youtube.com/@channel')).toBeNull();
  });

  // Facebook Reels
  it('identifies facebook.com /reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('identifies facebook.com /reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('identifies fb.watch URL as facebook_reels', () => {
    expect(detectPlatform('https://fb.watch/abc')).toBe('facebook_reels');
  });

  it('returns null for facebook.com post (not a reel)', () => {
    expect(detectPlatform('https://www.facebook.com/user/posts/123')).toBeNull();
  });

  it('returns null for facebook.com videos (not /reel/)', () => {
    expect(detectPlatform('https://www.facebook.com/watch/?v=123')).toBeNull();
  });

  // Unknown / invalid
  it('returns null for instagram URL', () => {
    expect(detectPlatform('https://www.instagram.com/p/abc/')).toBeNull();
  });

  it('returns null for twitter/X URL', () => {
    expect(detectPlatform('https://x.com/user/status/123')).toBeNull();
  });

  it('returns null for completely invalid string', () => {
    expect(detectPlatform('not a url at all')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for bare domain without protocol', () => {
    expect(detectPlatform('tiktok.com/@user/video/1')).toBeNull();
  });

  it('handles subdomain of facebook.com with reel', () => {
    expect(detectPlatform('https://business.facebook.com/reel/999')).toBe('facebook_reels');
  });
});

// ---------------------------------------------------------------------------
// buildAccountProfileUrl
// ---------------------------------------------------------------------------

describe('buildAccountProfileUrl', () => {
  describe('youtube', () => {
    it('prepends @ when handle has no @', () => {
      expect(buildAccountProfileUrl('youtube', 'mychannel')).toBe('https://www.youtube.com/@mychannel');
    });

    it('keeps existing @ prefix', () => {
      expect(buildAccountProfileUrl('youtube', '@mychannel')).toBe('https://www.youtube.com/@mychannel');
    });

    it('handles handle with digits', () => {
      expect(buildAccountProfileUrl('youtube', 'channel123')).toBe('https://www.youtube.com/@channel123');
    });
  });

  describe('tiktok', () => {
    it('strips leading @ before adding it back', () => {
      expect(buildAccountProfileUrl('tiktok', '@user123')).toBe('https://www.tiktok.com/@user123');
    });

    it('adds @ when missing', () => {
      expect(buildAccountProfileUrl('tiktok', 'user123')).toBe('https://www.tiktok.com/@user123');
    });

    it('strips a single leading @ correctly (only one @ prefix in result)', () => {
      const url = buildAccountProfileUrl('tiktok', '@user');
      expect(url).toBe('https://www.tiktok.com/@user');
    });
  });

  describe('instagram', () => {
    it('strips leading @ and appends trailing slash', () => {
      expect(buildAccountProfileUrl('instagram', '@instagramuser')).toBe(
        'https://www.instagram.com/instagramuser/'
      );
    });

    it('adds trailing slash when @ is absent', () => {
      expect(buildAccountProfileUrl('instagram', 'instagramuser')).toBe(
        'https://www.instagram.com/instagramuser/'
      );
    });

    it('does not produce double slashes', () => {
      const url = buildAccountProfileUrl('instagram', 'user');
      expect(url.split('//').length).toBe(2); // only one double slash (https://)
    });
  });
});
