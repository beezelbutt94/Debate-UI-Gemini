import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ── detectPlatform ──────────────────────────────────────────────────────────

describe('detectPlatform()', () => {
  // TikTok
  it('detects tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/@creator/video/123')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@creator/video/456')).toBe('tiktok');
  });

  it('detects vm.tiktok.com subdomain', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc123/')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com/shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('detects youtube.com/shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc')).toBe('youtube_shorts');
  });

  it('detects youtu.be (short link)', () => {
    expect(detectPlatform('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('returns null for youtube.com without /shorts/', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=abc')).toBeNull();
  });

  it('returns null for youtube.com/channel', () => {
    expect(detectPlatform('https://www.youtube.com/channel/UC123')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com/reel/', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456')).toBe('facebook_reels');
  });

  it('detects facebook.com/reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/789')).toBe('facebook_reels');
  });

  it('detects fb.watch', () => {
    expect(detectPlatform('https://fb.watch/abc123/')).toBe('facebook_reels');
  });

  it('returns null for facebook.com without /reel/', () => {
    expect(detectPlatform('https://www.facebook.com/profile')).toBeNull();
  });

  it('returns null for facebook.com post (not reel)', () => {
    expect(detectPlatform('https://www.facebook.com/story.php?story_fbid=123')).toBeNull();
  });

  // Unknown / invalid
  it('returns null for instagram.com', () => {
    expect(detectPlatform('https://www.instagram.com/p/abc/')).toBeNull();
  });

  it('returns null for a random URL', () => {
    expect(detectPlatform('https://example.com/video/123')).toBeNull();
  });

  it('returns null for a malformed URL', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for bare hostname with no scheme', () => {
    expect(detectPlatform('tiktok.com/@user')).toBeNull();
  });
});

// ── buildAccountProfileUrl ──────────────────────────────────────────────────

describe('buildAccountProfileUrl()', () => {
  // YouTube
  it('builds youtube URL for bare handle', () => {
    expect(buildAccountProfileUrl('youtube', 'mrBeast')).toBe(
      'https://www.youtube.com/@mrBeast'
    );
  });

  it('does not double-add @ for youtube handle', () => {
    expect(buildAccountProfileUrl('youtube', '@mrBeast')).toBe(
      'https://www.youtube.com/@mrBeast'
    );
  });

  it('youtube handle with only @ passes it through as-is', () => {
    // '@' already starts with '@', so the function uses it directly
    expect(buildAccountProfileUrl('youtube', '@')).toBe('https://www.youtube.com/@');
  });

  // TikTok
  it('builds tiktok URL for handle without @', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe(
      'https://www.tiktok.com/@charlidamelio'
    );
  });

  it('strips leading @ for tiktok before adding it', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe(
      'https://www.tiktok.com/@charlidamelio'
    );
  });

  it('does not add double @ to tiktok', () => {
    const url = buildAccountProfileUrl('tiktok', '@creator');
    expect(url).toBe('https://www.tiktok.com/@creator');
    expect(url).not.toContain('@@');
  });

  // Instagram
  it('builds instagram URL for handle without @', () => {
    expect(buildAccountProfileUrl('instagram', 'kyliejenner')).toBe(
      'https://www.instagram.com/kyliejenner/'
    );
  });

  it('strips leading @ for instagram', () => {
    expect(buildAccountProfileUrl('instagram', '@kyliejenner')).toBe(
      'https://www.instagram.com/kyliejenner/'
    );
  });

  it('instagram URL ends with trailing slash', () => {
    const url = buildAccountProfileUrl('instagram', 'test');
    expect(url.endsWith('/')).toBe(true);
  });
});
