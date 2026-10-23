import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ─── detectPlatform ───────────────────────────────────────────────────────────

describe('detectPlatform()', () => {
  // TikTok
  it('detects tiktok.com video URLs', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects bare tiktok.com (no www)', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok subdomains (e.g. vm.tiktok.com)', () => {
    expect(detectPlatform('https://vm.tiktok.com/xyz')).toBe('tiktok');
  });

  it('detects m.tiktok.com (mobile subdomain)', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com /shorts/ URLs', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abcdef')).toBe('youtube_shorts');
  });

  it('detects youtube.com /shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abcdef')).toBe('youtube_shorts');
  });

  it('detects youtu.be short links as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/abcdef')).toBe('youtube_shorts');
  });

  it('rejects regular youtube.com watch URLs (not shorts)', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abcdef')).toBeNull();
  });

  it('rejects youtube.com channel pages', () => {
    expect(detectPlatform('https://www.youtube.com/@channelname')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com /reel/ URLs', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects facebook.com /reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects fb.watch short links as facebook_reels', () => {
    expect(detectPlatform('https://fb.watch/abc123/')).toBe('facebook_reels');
  });

  it('rejects facebook.com posts that are not reels', () => {
    expect(detectPlatform('https://www.facebook.com/photo?fbid=123')).toBeNull();
  });

  it('rejects facebook.com groups (not a reel URL)', () => {
    expect(detectPlatform('https://www.facebook.com/groups/mygroup')).toBeNull();
  });

  // Invalid / unsupported
  it('returns null for plain text (not a URL)', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for an Instagram URL', () => {
    expect(detectPlatform('https://www.instagram.com/reel/abc123')).toBeNull();
  });

  it('returns null for a Twitter/X URL', () => {
    expect(detectPlatform('https://x.com/user/status/123')).toBeNull();
  });

  it('returns null for a generic HTTPS URL', () => {
    expect(detectPlatform('https://example.com/video/123')).toBeNull();
  });

  it('returns null for an HTTP URL that is not a supported platform', () => {
    expect(detectPlatform('http://vimeo.com/12345')).toBeNull();
  });

  it('returns null for a URL with a port number that is not a supported platform', () => {
    expect(detectPlatform('http://localhost:3000/shorts/abc')).toBeNull();
  });

  it('handles a tiktok.com URL with query params', () => {
    expect(detectPlatform('https://www.tiktok.com/@creator/video/7000000000000000001?lang=en')).toBe('tiktok');
  });

  it('handles a YouTube Shorts URL with additional query params', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc?feature=share')).toBe('youtube_shorts');
  });
});

// ─── buildAccountProfileUrl ───────────────────────────────────────────────────

describe('buildAccountProfileUrl()', () => {
  // YouTube
  it('builds a YouTube URL for a handle with @ prefix', () => {
    expect(buildAccountProfileUrl('youtube', '@mychannel')).toBe('https://www.youtube.com/@mychannel');
  });

  it('builds a YouTube URL for a handle WITHOUT @ prefix (adds it)', () => {
    expect(buildAccountProfileUrl('youtube', 'mychannel')).toBe('https://www.youtube.com/@mychannel');
  });

  it('does not double-add @ for YouTube', () => {
    expect(buildAccountProfileUrl('youtube', '@mychannel')).not.toContain('@@');
  });

  // TikTok
  it('builds a TikTok URL for a handle with @ prefix', () => {
    expect(buildAccountProfileUrl('tiktok', '@myuser')).toBe('https://www.tiktok.com/@myuser');
  });

  it('builds a TikTok URL for a handle WITHOUT @ prefix (adds it)', () => {
    expect(buildAccountProfileUrl('tiktok', 'myuser')).toBe('https://www.tiktok.com/@myuser');
  });

  it('does not double-add @ for TikTok', () => {
    expect(buildAccountProfileUrl('tiktok', '@myuser')).not.toContain('@@');
  });

  // Instagram
  it('builds an Instagram URL for a handle with @ prefix (strips it)', () => {
    expect(buildAccountProfileUrl('instagram', '@myprofile')).toBe('https://www.instagram.com/myprofile/');
  });

  it('builds an Instagram URL for a handle WITHOUT @ prefix', () => {
    expect(buildAccountProfileUrl('instagram', 'myprofile')).toBe('https://www.instagram.com/myprofile/');
  });

  it('Instagram URL ends with trailing slash', () => {
    const url = buildAccountProfileUrl('instagram', 'anyhandle');
    expect(url.endsWith('/')).toBe(true);
  });

  // General structure
  it('returns a valid URL for all three platforms', () => {
    const platforms = ['youtube', 'tiktok', 'instagram'] as const;
    for (const platform of platforms) {
      const url = buildAccountProfileUrl(platform, 'testhandle');
      expect(() => new URL(url)).not.toThrow();
    }
  });

  it('handles handles with numbers and underscores', () => {
    expect(buildAccountProfileUrl('youtube', 'my_channel_2024')).toBe('https://www.youtube.com/@my_channel_2024');
    expect(buildAccountProfileUrl('tiktok', 'my_user_2024')).toBe('https://www.tiktok.com/@my_user_2024');
    expect(buildAccountProfileUrl('instagram', 'my.profile.2024')).toBe('https://www.instagram.com/my.profile.2024/');
  });
});
