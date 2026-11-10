import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ─── detectPlatform ──────────────────────────────────────────────────────────

describe('detectPlatform()', () => {
  // TikTok
  it('detects bare tiktok.com URL', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@user/video/999')).toBe('tiktok');
  });

  it('detects tiktok subdomain (vm.tiktok.com)', () => {
    expect(detectPlatform('https://vm.tiktok.com/abc123')).toBe('tiktok');
  });

  // YouTube Shorts
  it('detects youtube.com /shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('detects youtube.com /shorts/ without www', () => {
    expect(detectPlatform('https://youtube.com/shorts/abc')).toBe('youtube_shorts');
  });

  it('detects youtu.be short link as youtube_shorts', () => {
    expect(detectPlatform('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('returns null for youtube.com non-shorts URL', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });

  // Facebook Reels
  it('detects facebook.com /reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456789')).toBe('facebook_reels');
  });

  it('detects facebook.com /reel/ without www', () => {
    expect(detectPlatform('https://facebook.com/reel/999')).toBe('facebook_reels');
  });

  it('detects fb.watch short URL as facebook_reels', () => {
    expect(detectPlatform('https://fb.watch/abc')).toBe('facebook_reels');
  });

  it('returns null for facebook.com non-reel URL', () => {
    expect(detectPlatform('https://www.facebook.com/groups/somegroup')).toBeNull();
  });

  // Not matching / edge cases
  it('returns null for a random URL', () => {
    expect(detectPlatform('https://www.instagram.com/p/abc/')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a non-URL string', () => {
    expect(detectPlatform('not a url at all')).toBeNull();
  });

  it('returns null for a URL with no recognized host', () => {
    expect(detectPlatform('https://example.com/video/123')).toBeNull();
  });

  it('returns null for a URL that only contains tiktok in path, not host', () => {
    expect(detectPlatform('https://example.com/tiktok/video')).toBeNull();
  });

  it('handles URL with uppercase protocol gracefully (URL parses it)', () => {
    // Browsers lowercase the protocol; Node's URL() does too.
    expect(detectPlatform('HTTPS://www.tiktok.com/@user/video/1')).toBe('tiktok');
  });

  // ── Mobile subdomains ────────────────────────────────────────────────────────

  it('detects m.youtube.com/shorts/ as youtube_shorts', () => {
    expect(detectPlatform('https://m.youtube.com/shorts/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('detects m.facebook.com/reel/ as facebook_reels', () => {
    expect(detectPlatform('https://m.facebook.com/reel/987654321')).toBe('facebook_reels');
  });

  it('detects m.tiktok.com as tiktok', () => {
    expect(detectPlatform('https://m.tiktok.com/@user/video/123')).toBe('tiktok');
  });

  // ── URLs with query parameters ───────────────────────────────────────────────

  it('detects TikTok URL with query parameters', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123?lang=en&refer=embed')).toBe('tiktok');
  });

  it('detects YouTube Shorts with share query param (si=)', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/dQw4w9WgXcQ?si=abc123XYZ')).toBe('youtube_shorts');
  });

  it('detects youtu.be with query parameters', () => {
    expect(detectPlatform('https://youtu.be/dQw4w9WgXcQ?si=xyz&feature=shared')).toBe('youtube_shorts');
  });

  it('detects Facebook reel URL with query parameters', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456?eav=xyz&_rdr')).toBe('facebook_reels');
  });

  it('detects fb.watch with query parameters as facebook_reels', () => {
    expect(detectPlatform('https://fb.watch/abc123/?mibextid=xyz')).toBe('facebook_reels');
  });

  // ── URLs with fragments ──────────────────────────────────────────────────────

  it('detects TikTok URL with a fragment', () => {
    expect(detectPlatform('https://www.tiktok.com/@user/video/123#comment')).toBe('tiktok');
  });

  it('detects YouTube Shorts URL with a fragment', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/abc#t=5')).toBe('youtube_shorts');
  });

  // ── Lookalike / homograph domains (security) ─────────────────────────────────

  it('returns null for a tiktok.com.evil.com lookalike domain', () => {
    expect(detectPlatform('https://tiktok.com.evil.com/@user/video/1')).toBeNull();
  });

  it('returns null for a youtube.com.evil.com lookalike domain', () => {
    expect(detectPlatform('https://youtube.com.evil.com/shorts/abc')).toBeNull();
  });

  it('returns null for a facebook.com.evil.com lookalike domain', () => {
    expect(detectPlatform('https://facebook.com.evil.com/reel/123')).toBeNull();
  });

  it('returns null when tiktok appears only in the path, not the host', () => {
    expect(detectPlatform('https://malicious.com/redirect?url=tiktok.com/@user')).toBeNull();
  });

  it('returns null for a youtube.com non-shorts URL with /shorts/ only in query string', () => {
    // /shorts not followed by / — should not detect as Shorts
    expect(detectPlatform('https://www.youtube.com/watch?v=abc&list=shorts')).toBeNull();
  });

  // ── Additional realistic cases ────────────────────────────────────────────────

  it('detects TikTok URL with numeric-only video id', () => {
    expect(detectPlatform('https://www.tiktok.com/@creator/video/7391234567890123456')).toBe('tiktok');
  });

  it('detects YouTube Shorts URL with 11-char video id', () => {
    expect(detectPlatform('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('returns null for http:// scheme on an invalid host', () => {
    expect(detectPlatform('http://localhost:3000/video/123')).toBeNull();
  });

  it('returns null for a URL with only a port and no recognized host', () => {
    expect(detectPlatform('https://192.168.1.1/shorts/abc')).toBeNull();
  });
});

// ─── buildAccountProfileUrl ──────────────────────────────────────────────────

describe('buildAccountProfileUrl()', () => {
  it('builds a YouTube URL for a bare handle', () => {
    expect(buildAccountProfileUrl('youtube', 'mkbhd')).toBe('https://www.youtube.com/@mkbhd');
  });

  it('does not double-add @ for YouTube when handle already starts with @', () => {
    expect(buildAccountProfileUrl('youtube', '@mkbhd')).toBe('https://www.youtube.com/@mkbhd');
  });

  it('builds a TikTok URL stripping leading @', () => {
    expect(buildAccountProfileUrl('tiktok', '@charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('builds a TikTok URL for a bare handle (no @)', () => {
    expect(buildAccountProfileUrl('tiktok', 'charlidamelio')).toBe('https://www.tiktok.com/@charlidamelio');
  });

  it('builds an Instagram URL stripping leading @', () => {
    expect(buildAccountProfileUrl('instagram', '@cristiano')).toBe('https://www.instagram.com/cristiano/');
  });

  it('builds an Instagram URL for a bare handle (no @)', () => {
    expect(buildAccountProfileUrl('instagram', 'cristiano')).toBe('https://www.instagram.com/cristiano/');
  });

  it('handles YouTube handle with numbers', () => {
    expect(buildAccountProfileUrl('youtube', 'channel123')).toBe('https://www.youtube.com/@channel123');
  });

  it('handles TikTok handle with dots and underscores', () => {
    expect(buildAccountProfileUrl('tiktok', 'user.name_123')).toBe('https://www.tiktok.com/@user.name_123');
  });

  it('TikTok: does not double-add @ when handle has @@', () => {
    // replace(/^@/, '') removes exactly one leading @
    expect(buildAccountProfileUrl('tiktok', '@@double')).toBe('https://www.tiktok.com/@@double');
  });

  it('YouTube: handle with numbers and underscores', () => {
    expect(buildAccountProfileUrl('youtube', 'creator_123')).toBe('https://www.youtube.com/@creator_123');
  });

  it('YouTube: handle with hyphens', () => {
    expect(buildAccountProfileUrl('youtube', '@my-channel')).toBe('https://www.youtube.com/@my-channel');
  });

  it('TikTok: handle with uppercase letters preserved', () => {
    expect(buildAccountProfileUrl('tiktok', 'MyHandle')).toBe('https://www.tiktok.com/@MyHandle');
  });

  it('Instagram: handle with numbers and underscores', () => {
    expect(buildAccountProfileUrl('instagram', 'user_123')).toBe('https://www.instagram.com/user_123/');
  });

  it('Instagram: handle with uppercase letters preserved', () => {
    expect(buildAccountProfileUrl('instagram', 'MyHandle')).toBe('https://www.instagram.com/MyHandle/');
  });

  it('TikTok: very long handle preserved verbatim after stripping @', () => {
    const handle = '@a_very_long_tiktok_handle_with_lots_of_chars_123';
    const bare = handle.slice(1);
    expect(buildAccountProfileUrl('tiktok', handle)).toBe(`https://www.tiktok.com/@${bare}`);
  });

  it('YouTube: returns different URL for different handles', () => {
    const a = buildAccountProfileUrl('youtube', 'channelA');
    const b = buildAccountProfileUrl('youtube', 'channelB');
    expect(a).not.toBe(b);
  });

  it('all three platforms return strings starting with https://', () => {
    expect(buildAccountProfileUrl('youtube', 'x').startsWith('https://')).toBe(true);
    expect(buildAccountProfileUrl('tiktok', 'x').startsWith('https://')).toBe(true);
    expect(buildAccountProfileUrl('instagram', 'x').startsWith('https://')).toBe(true);
  });
});
