import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ---------------------------------------------------------------------------
// detectPlatform
// ---------------------------------------------------------------------------
describe('detectPlatform()', () => {
  // TikTok
  it('returns tiktok for a standard tiktok.com URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@creator/video/123')).toBe('tiktok');
  });

  it('returns tiktok for tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@creator/video/123')).toBe('tiktok');
  });

  it('returns tiktok for a tiktok subdomain', () => {
    expect(detectPlatform('https://vm.tiktok.com/ZMhsRQEjk/')).toBe('tiktok');
  });

  // YouTube Shorts
  it('returns youtube_shorts for a /shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });

  it('returns youtube_shorts for youtu.be', () => {
    expect(detectPlatform('https://youtu.be/abc123')).toBe('youtube_shorts');
  });

  it('returns null for a plain youtube.com watch URL (not shorts)', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc123')).toBeNull();
  });

  it('returns null for youtube.com channel page', () => {
    expect(detectPlatform('https://www.youtube.com/@creator')).toBeNull();
  });

  // Facebook Reels
  it('returns facebook_reels for a facebook.com /reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('returns facebook_reels for facebook.com without www', () => {
    expect(detectPlatform('https://facebook.com/reel/987654321')).toBe('facebook_reels');
  });

  it('returns facebook_reels for fb.watch short link', () => {
    expect(detectPlatform('https://fb.watch/abcdef/')).toBe('facebook_reels');
  });

  it('returns null for a facebook.com post (not reel)', () => {
    expect(detectPlatform('https://www.facebook.com/post/123456789')).toBeNull();
  });

  // Invalid inputs
  it('returns null for a plain string (not a URL)', () => {
    expect(detectPlatform('not a url at all')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for an unrecognised domain', () => {
    expect(detectPlatform('https://instagram.com/p/abc123')).toBeNull();
  });

  it('returns null for a localhost URL', () => {
    expect(detectPlatform('http://localhost:3000/video/123')).toBeNull();
  });

  it('returns null for a URL with no path', () => {
    expect(detectPlatform('https://www.example.com/')).toBeNull();
  });

  // Edge: youtube subdomain with /shorts/
  it('returns youtube_shorts for m.youtube.com/shorts/', () => {
    expect(detectPlatform('https://m.youtube.com/shorts/abc123')).toBe('youtube_shorts');
  });
});

// ---------------------------------------------------------------------------
// buildAccountProfileUrl
// ---------------------------------------------------------------------------
describe('buildAccountProfileUrl()', () => {
  // YouTube
  it('prefixes @ for youtube handle without @', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe(
      'https://www.youtube.com/@MrBeast'
    );
  });

  it('preserves existing @ for youtube handle', () => {
    expect(buildAccountProfileUrl('youtube', '@MrBeast')).toBe(
      'https://www.youtube.com/@MrBeast'
    );
  });

  // TikTok
  it('removes leading @ then prepends for tiktok', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe(
      'https://www.tiktok.com/@charlidamelio'
    );
  });

  it('prepends @ for tiktok handle without @', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe(
      'https://www.tiktok.com/@charlidamelio'
    );
  });

  // Instagram
  it('removes leading @ for instagram handle', () => {
    expect(buildAccountProfileUrl('instagram', '@natgeo')).toBe(
      'https://www.instagram.com/natgeo/'
    );
  });

  it('uses handle without @ for instagram', () => {
    expect(buildAccountProfileUrl('instagram', 'natgeo')).toBe(
      'https://www.instagram.com/natgeo/'
    );
  });

  it('builds correct instagram URL with trailing slash', () => {
    const url = buildAccountProfileUrl('instagram', 'someuser');
    expect(url.endsWith('/')).toBe(true);
  });

  // Idempotency for handles with uppercase
  it('preserves handle casing for youtube', () => {
    expect(buildAccountProfileUrl('youtube', 'NASAHubble')).toBe(
      'https://www.youtube.com/@NASAHubble'
    );
  });
});
