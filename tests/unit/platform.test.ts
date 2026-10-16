import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

describe('detectPlatform()', () => {
  // TikTok URLs
  it('detects tiktok.com video URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/1234567890')).toBe('tiktok');
  });

  it('detects bare tiktok.com (no www)', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/1234')).toBe('tiktok');
  });

  it('detects TikTok subdomain URLs', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/1234')).toBe('tiktok');
  });

  // YouTube Shorts URLs
  it('detects youtube.com /shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abcDEF123')).toBe('youtube_shorts');
  });

  it('detects youtube.com /shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abcDEF123')).toBe('youtube_shorts');
  });

  it('detects youtu.be short link as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/abcDEF123')).toBe('youtube_shorts');
  });

  it('returns null for youtube.com URL that is NOT /shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abcDEF123')).toBeNull();
  });

  it('returns null for youtube.com channel URL', () => {
    expect(detectPlatform('https://www.youtube.com/@SomeChannel')).toBeNull();
  });

  // Facebook Reels URLs
  it('detects facebook.com /reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/1234567890')).toBe('facebook_reels');
  });

  it('returns null for facebook.com /reels/ (only /reel/ is matched, not /reels/)', () => {
    // rawUrl.includes('/reel/') — "/reels/" contains the substring "/reel" but
    // the character after it is "s", not "/", so the check correctly returns null.
    expect(detectPlatform('https://www.facebook.com/reels/1234567890')).toBeNull();
  });

  it('detects fb.watch URL', () => {
    expect(detectPlatform('https://fb.watch/abc123/')).toBe('facebook_reels');
  });

  it('detects facebook.com /reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/999')).toBe('facebook_reels');
  });

  it('detects facebook.com subdomain /reel/', () => {
    expect(detectPlatform('https://m.facebook.com/reel/999')).toBe('facebook_reels');
  });

  it('returns null for facebook.com without /reel/', () => {
    expect(detectPlatform('https://www.facebook.com/someuser/posts/123')).toBeNull();
  });

  // Unknown / invalid URLs
  it('returns null for an unrecognized domain', () => {
    expect(detectPlatform('https://instagram.com/p/abc123/')).toBeNull();
  });

  it('returns null for a plain string (no protocol)', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a twitter/x URL', () => {
    expect(detectPlatform('https://twitter.com/user/status/123')).toBeNull();
  });

  it('returns null for a random HTTPS URL', () => {
    expect(detectPlatform('https://example.com/video/123')).toBeNull();
  });
});

describe('buildAccountProfileUrl()', () => {
  // YouTube
  it('builds youtube URL with @ handle (already has @)', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('builds youtube URL with handle without @ (adds @)', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });

  it('does not double-add @ for youtube', () => {
    const url = buildAccountProfileUrl('youtube', '@MrBeast');
    expect(url).not.toContain('@@');
  });

  // TikTok
  it('builds tiktok URL with @ handle (strips existing @ before adding)', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('builds tiktok URL with handle without @', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('does not double-add @ for tiktok', () => {
    const url = buildAccountProfileUrl('tiktok', '@charli');
    expect(url).not.toContain('@@');
  });

  // Instagram
  it('builds instagram URL with handle (strips @)', () => {
    expect(buildAccountProfileUrl('instagram', '@natgeo')).toBe('https://www.instagram.com/natgeo/');
  });

  it('builds instagram URL with handle without @', () => {
    expect(buildAccountProfileUrl('instagram', 'natgeo')).toBe('https://www.instagram.com/natgeo/');
  });

  it('instagram URL ends with trailing slash', () => {
    const url = buildAccountProfileUrl('instagram', 'test');
    expect(url.endsWith('/')).toBe(true);
  });

  it('builds youtube URL with mixed-case handle', () => {
    expect(buildAccountProfileUrl('youtube', 'TheScienceChannel')).toBe(
      'https://www.youtube.com/@TheScienceChannel'
    );
  });

  it('builds tiktok URL preserves handle casing', () => {
    expect(buildAccountProfileUrl('tiktok', 'MyHandle')).toBe('https://www.tiktok.com/@MyHandle');
  });
});
