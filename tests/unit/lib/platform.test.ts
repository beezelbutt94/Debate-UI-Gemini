import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ── detectPlatform ────────────────────────────────────────────────────────────

describe('detectPlatform()', () => {
  // TikTok
  it('detects plain tiktok.com URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects subdomain of tiktok.com', () => {
    expect(detectPlatform('https://vm.tiktok.com/ABC/')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com /shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abcXYZ')).toBe('youtube_shorts');
  });

  it('detects youtube.com /shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abcXYZ')).toBe('youtube_shorts');
  });

  it('detects youtu.be short link', () => {
    expect(detectPlatform('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('does NOT detect regular youtube watch URL as shorts', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com /reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects facebook.com /reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects fb.watch URL', () => {
    expect(detectPlatform('https://fb.watch/abc123/')).toBe('facebook_reels');
  });

  it('does NOT detect a regular facebook.com page as reels', () => {
    expect(detectPlatform('https://www.facebook.com/someuser')).toBeNull();
  });

  // Invalid / unsupported
  it('returns null for an invalid URL string', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a twitter URL', () => {
    expect(detectPlatform('https://twitter.com/user/status/1')).toBeNull();
  });

  it('returns null for an instagram URL', () => {
    expect(detectPlatform('https://www.instagram.com/p/ABC/')).toBeNull();
  });

  it('returns null for a random HTTPS URL', () => {
    expect(detectPlatform('https://example.com/video/123')).toBeNull();
  });

  it('strips www correctly so m.tiktok.com is treated as a tiktok subdomain', () => {
    // m.tiktok.com → host after stripping www: m.tiktok.com → endsWith('.tiktok.com') → true
    expect(detectPlatform('https://m.tiktok.com/@user/video/123')).toBe('tiktok');
  });
});

// ── buildAccountProfileUrl ────────────────────────────────────────────────────

describe('buildAccountProfileUrl()', () => {
  // YouTube
  it('youtube: prepends @ when handle has no @', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('youtube: preserves existing @ prefix', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  // TikTok
  it('tiktok: removes leading @ before prepending it back', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('tiktok: adds @ when handle has none', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  // Instagram
  it('instagram: strips leading @ before building URL', () => {
    expect(buildAccountProfileUrl('instagram', '@nasa')).toBe('https://www.instagram.com/nasa/');
  });

  it('instagram: handles handle without @', () => {
    expect(buildAccountProfileUrl('instagram', 'nasa')).toBe('https://www.instagram.com/nasa/');
  });

  it('instagram: preserves mixed-case handle', () => {
    expect(buildAccountProfileUrl('instagram', 'NatGeo')).toBe('https://www.instagram.com/NatGeo/');
  });

  it('youtube: handles handle with numbers', () => {
    expect(buildAccountProfileUrl('youtube', 'channel42')).toBe('https://www.youtube.com/@channel42');
  });

  it('tiktok: handles handle with underscores', () => {
    expect(buildAccountProfileUrl('tiktok', 'my_handle')).toBe('https://www.tiktok.com/@my_handle');
  });
});
