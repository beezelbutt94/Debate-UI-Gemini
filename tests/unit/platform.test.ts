import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ---------------------------------------------------------------------------
// detectPlatform
// ---------------------------------------------------------------------------
describe('detectPlatform()', () => {
  // TikTok
  it('detects tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/456')).toBe('tiktok');
  });

  it('detects subdomain tiktok', () => {
    expect(detectPlatform('https://vm.tiktok.com/ZMe1XXXXX/')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com shorts URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abcdef')).toBe('youtube_shorts');
  });

  it('detects youtube.com shorts without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/xyz')).toBe('youtube_shorts');
  });

  it('detects youtu.be (short link treated as shorts)', () => {
    expect(detectPlatform('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('rejects youtube.com watch URL (not a short)', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });

  it('rejects youtube.com channel URL', () => {
    expect(detectPlatform('https://www.youtube.com/@SomeChannel')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com reel URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('detects facebook.com reel without www', () => {
    expect(detectPlatform('https://facebook.com/reel/987')).toBe('facebook_reels');
  });

  it('detects fb.watch short link', () => {
    expect(detectPlatform('https://fb.watch/abcXYZ/')).toBe('facebook_reels');
  });

  it('rejects facebook.com regular post', () => {
    expect(detectPlatform('https://www.facebook.com/photo?fbid=123')).toBeNull();
  });

  it('rejects facebook.com page URL', () => {
    expect(detectPlatform('https://www.facebook.com/SomePage')).toBeNull();
  });

  // Unknown / invalid
  it('returns null for an unrecognised domain', () => {
    expect(detectPlatform('https://instagram.com/p/ABC123')).toBeNull();
  });

  it('returns null for an invalid (non-URL) string', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a twitter URL', () => {
    expect(detectPlatform('https://twitter.com/i/status/12345')).toBeNull();
  });

  it('returns null for a vimeo URL', () => {
    expect(detectPlatform('https://vimeo.com/123456789')).toBeNull();
  });

  it('returns null for a plain domain without https', () => {
    // No schema → URL constructor throws → null
    expect(detectPlatform('tiktok.com/@user/video/1')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// buildAccountProfileUrl
// ---------------------------------------------------------------------------
describe('buildAccountProfileUrl()', () => {
  // YouTube
  it('prepends @ to bare youtube handle', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe(
      'https://www.youtube.com/@MrBeast'
    );
  });

  it('does not double-@ for youtube', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe(
      'https://www.youtube.com/@MrBeast'
    );
  });

  // TikTok
  it('strips leading @ from tiktok handle', () => {
    expect(buildAccountProfileUrl('tiktok', '@charli_damelio')).toBe(
      'https://www.tiktok.com/@charli_damelio'
    );
  });

  it('adds @ to bare tiktok handle', () => {
    expect(buildAccountProfileUrl('tiktok', 'charli_damelio')).toBe(
      'https://www.tiktok.com/@charli_damelio'
    );
  });

  // Instagram
  it('strips leading @ from instagram handle', () => {
    expect(buildAccountProfileUrl('instagram', '@cristiano')).toBe(
      'https://www.instagram.com/cristiano/'
    );
  });

  it('builds instagram URL from bare handle', () => {
    expect(buildAccountProfileUrl('instagram', 'cristiano')).toBe(
      'https://www.instagram.com/cristiano/'
    );
  });

  it('instagram URL ends with trailing slash', () => {
    const url = buildAccountProfileUrl('instagram', 'someone');
    expect(url.endsWith('/')).toBe(true);
  });

  it('youtube URL does not end with trailing slash', () => {
    const url = buildAccountProfileUrl('youtube', 'someone');
    expect(url.endsWith('/')).toBe(false);
  });

  it('handle with underscores and numbers - tiktok', () => {
    expect(buildAccountProfileUrl('tiktok', 'user_123')).toBe(
      'https://www.tiktok.com/@user_123'
    );
  });

  it('handle with underscores and numbers - youtube', () => {
    expect(buildAccountProfileUrl('youtube', 'user_123')).toBe(
      'https://www.youtube.com/@user_123'
    );
  });
});
