import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform', () => {
  describe('TikTok', () => {
    it('detects www.tiktok.com', () => {
      expect(detectPlatform('https://www.tiktok.com/@user/video/123456')).toBe('tiktok');
    });

    it('detects tiktok.com without www', () => {
      expect(detectPlatform('https://tiktok.com/@creator/video/789')).toBe('tiktok');
    });

    it('detects m.tiktok.com subdomain', () => {
      expect(detectPlatform('https://m.tiktok.com/@user/video/123')).toBe('tiktok');
    });

    it('detects vm.tiktok.com (share links)', () => {
      expect(detectPlatform('https://vm.tiktok.com/abc123/')).toBe('tiktok');
    });
  });

  describe('YouTube Shorts', () => {
    it('detects www.youtube.com/shorts/', () => {
      expect(detectPlatform('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('youtube_shorts');
    });

    it('detects youtube.com/shorts/ without www', () => {
      expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
    });

    it('detects youtu.be short links', () => {
      expect(detectPlatform('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube_shorts');
    });

    it('returns null for a standard youtube.com watch URL', () => {
      expect(detectPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
    });

    it('returns null for a youtube.com channel URL', () => {
      expect(detectPlatform('https://www.youtube.com/@MrBeast')).toBeNull();
    });
  });

  describe('Facebook Reels', () => {
    it('detects www.facebook.com/reel/', () => {
      expect(detectPlatform('https://www.facebook.com/reel/1234567890')).toBe('facebook_reels');
    });

    it('detects facebook.com/reel/ without www', () => {
      expect(detectPlatform('https://facebook.com/reel/abc')).toBe('facebook_reels');
    });

    it('detects fb.watch share links', () => {
      expect(detectPlatform('https://fb.watch/abc123def/')).toBe('facebook_reels');
    });

    it('returns null for a facebook.com/videos/ URL', () => {
      expect(detectPlatform('https://www.facebook.com/videos/123456')).toBeNull();
    });

    it('returns null for a facebook.com profile URL', () => {
      expect(detectPlatform('https://www.facebook.com/username')).toBeNull();
    });
  });

  describe('unsupported / invalid', () => {
    it('returns null for Instagram', () => {
      expect(detectPlatform('https://www.instagram.com/reel/abc123/')).toBeNull();
    });

    it('returns null for Twitter/X', () => {
      expect(detectPlatform('https://x.com/user/status/123')).toBeNull();
    });

    it('returns null for a random URL', () => {
      expect(detectPlatform('https://example.com/video/123')).toBeNull();
    });

    it('returns null for a plain string that is not a URL', () => {
      expect(detectPlatform('not-a-url')).toBeNull();
    });

    it('returns null for an empty string', () => {
      expect(detectPlatform('')).toBeNull();
    });

    it('returns null for a bare domain with no scheme', () => {
      expect(detectPlatform('tiktok.com/@user')).toBeNull();
    });
  });
});

describe('buildAccountProfileUrl', () => {
  describe('youtube', () => {
    it('builds URL for handle that already starts with @', () => {
      expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
    });

    it('prepends @ for handle without it', () => {
      expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
    });

    it('handles empty handle', () => {
      expect(buildAccountProfileUrl('youtube', '')).toBe('https://www.youtube.com/@');
    });
  });

  describe('tiktok', () => {
    it('builds URL for handle that already starts with @', () => {
      expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
    });

    it('prepends @ for handle without it', () => {
      expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
    });

    it('does not double-add @ for handle that already has it', () => {
      const url = buildAccountProfileUrl('tiktok', '@user');
      expect(url).toBe('https://www.tiktok.com/@user');
      expect(url).not.toContain('@@');
    });
  });

  describe('instagram', () => {
    it('builds URL for handle that already starts with @', () => {
      expect(buildAccountProfileUrl('instagram', '@cristiano')).toBe('https://www.instagram.com/cristiano/');
    });

    it('builds URL for handle without @', () => {
      expect(buildAccountProfileUrl('instagram', 'cristiano')).toBe('https://www.instagram.com/cristiano/');
    });

    it('strips leading @ and does not include it in URL', () => {
      const url = buildAccountProfileUrl('instagram', '@creator');
      expect(url).not.toContain('@');
      expect(url).toBe('https://www.instagram.com/creator/');
    });
  });
});
