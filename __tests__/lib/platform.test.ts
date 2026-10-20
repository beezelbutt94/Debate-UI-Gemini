import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ── detectPlatform ────────────────────────────────────────────────────────────

describe('detectPlatform – TikTok', () => {
  it('detects plain tiktok.com video URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/12345')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/12345')).toBe('tiktok');
  });

  it('detects subdomain of tiktok.com (m.tiktok.com)', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/12345')).toBe('tiktok');
  });

  it('returns null for a tiktok.com URL without a video path (edge: still a valid TikTok host)', () => {
    // The function only checks the host, not the path for TikTok.
    expect(detectPlatform('https://tiktok.com/')).toBe('tiktok');
  });
});

describe('detectPlatform – YouTube Shorts', () => {
  it('detects youtube.com/shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects m.youtube.com/shorts/', () => {
    expect(detectPlatform('https://m.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('detects youtu.be short link as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('returns null for a regular youtube.com/watch URL (not a short)', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });

  it('returns null for youtube.com channel URL', () => {
    expect(detectPlatform('https://www.youtube.com/@SomeChannel')).toBeNull();
  });
});

describe('detectPlatform – Facebook Reels', () => {
  it('detects facebook.com/reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/12345678')).toBe('facebook_reels');
  });

  it('detects facebook.com/reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/12345678')).toBe('facebook_reels');
  });

  it('detects fb.watch URL as facebook_reels', () => {
    expect(detectPlatform('https://fb.watch/abc123/')).toBe('facebook_reels');
  });

  it('returns null for a regular facebook.com post URL without /reel/', () => {
    expect(detectPlatform('https://www.facebook.com/groups/something/posts/12345')).toBeNull();
  });
});

describe('detectPlatform – invalid / other', () => {
  it('returns null for completely invalid URL string', () => {
    expect(detectPlatform('not a url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for an unrelated domain', () => {
    expect(detectPlatform('https://instagram.com/reel/abc123')).toBeNull();
  });

  it('returns null for twitter/X URL', () => {
    expect(detectPlatform('https://twitter.com/user/status/12345')).toBeNull();
  });

  it('returns null for a bare hostname without scheme', () => {
    expect(detectPlatform('tiktok.com/@user/video/12345')).toBeNull();
  });

  it('returns null for an IP address', () => {
    expect(detectPlatform('https://192.168.1.1/video/123')).toBeNull();
  });
});

// ── buildAccountProfileUrl ────────────────────────────────────────────────────

describe('buildAccountProfileUrl – youtube', () => {
  it('prepends @ when handle has no @ prefix', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('keeps existing @ prefix', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('handles handle with numbers', () => {
    expect(buildAccountProfileUrl('youtube', 'Channel123')).toBe('https://www.youtube.com/@Channel123');
  });
});

describe('buildAccountProfileUrl – tiktok', () => {
  it('strips leading @ before adding it back', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('adds @ when missing', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('handles mixed case handle', () => {
    expect(buildAccountProfileUrl('tiktok', 'SomeCreator')).toBe('https://www.tiktok.com/@SomeCreator');
  });
});

describe('buildAccountProfileUrl – instagram', () => {
  it('strips leading @ before building URL', () => {
    expect(buildAccountProfileUrl('instagram', '@cristiano')).toBe('https://www.instagram.com/cristiano/');
  });

  it('adds trailing slash and no @ in URL', () => {
    expect(buildAccountProfileUrl('instagram', 'cristiano')).toBe('https://www.instagram.com/cristiano/');
  });

  it('handles underscore in handle', () => {
    expect(buildAccountProfileUrl('instagram', 'some_creator')).toBe('https://www.instagram.com/some_creator/');
  });
});
