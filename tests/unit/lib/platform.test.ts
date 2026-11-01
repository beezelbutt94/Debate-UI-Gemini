import { describe, it, expect } from 'vitest';
import { detectPlatform, buildAccountProfileUrl } from '@/lib/platform';

// ── detectPlatform ──────────────────────────────────────────────────────────

describe('detectPlatform() — TikTok', () => {
  it('detects tiktok.com', () => {
    expect(detectPlatform('https://www.tiktok.com/@creator/video/123456')).toBe('tiktok');
  });

  it('detects tiktok.com without www', () => {
    expect(detectPlatform('https://tiktok.com/@creator/video/123456')).toBe('tiktok');
  });

  it('detects vm.tiktok.com subdomain', () => {
    expect(detectPlatform('https://vm.tiktok.com/ZMr123abc/')).toBe('tiktok');
  });

  it('detects vt.tiktok.com subdomain', () => {
    expect(detectPlatform('https://vt.tiktok.com/ZMr999/')).toBe('tiktok');
  });
});

describe('detectPlatform() — YouTube Shorts', () => {
  it('detects youtube.com/shorts/ URL', () => {
    expect(detectPlatform('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('detects youtu.be short link', () => {
    expect(detectPlatform('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube_shorts');
  });

  it('does NOT detect regular youtube.com watch URL', () => {
    expect(detectPlatform('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });

  it('does NOT detect youtube.com channel page', () => {
    expect(detectPlatform('https://www.youtube.com/@Creator')).toBeNull();
  });
});

describe('detectPlatform() — Facebook Reels', () => {
  it('detects facebook.com/reel/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/reel/123456789012345')).toBe('facebook_reels');
  });

  it('detects fb.watch short link', () => {
    expect(detectPlatform('https://fb.watch/abc123xyz/')).toBe('facebook_reels');
  });

  it('does NOT detect facebook.com/video/ URL', () => {
    expect(detectPlatform('https://www.facebook.com/video/123456789')).toBeNull();
  });

  it('does NOT detect plain facebook.com URL', () => {
    expect(detectPlatform('https://www.facebook.com/')).toBeNull();
  });
});

describe('detectPlatform() — unsupported / invalid', () => {
  it('returns null for Instagram', () => {
    expect(detectPlatform('https://www.instagram.com/p/CrandomID/')).toBeNull();
  });

  it('returns null for Twitter/X', () => {
    expect(detectPlatform('https://twitter.com/user/status/12345')).toBeNull();
  });

  it('returns null for a random website', () => {
    expect(detectPlatform('https://www.example.com/video/123')).toBeNull();
  });

  it('returns null for a completely invalid string', () => {
    expect(detectPlatform('not-a-url')).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(detectPlatform('')).toBeNull();
  });

  it('returns null for a bare domain with no scheme', () => {
    expect(detectPlatform('tiktok.com/@user/video/1')).toBeNull();
  });
});

// ── buildAccountProfileUrl ──────────────────────────────────────────────────

describe('buildAccountProfileUrl() — youtube', () => {
  it('prepends @ when handle has no @', () => {
    expect(buildAccountProfileUrl('youtube', 'mychannel')).toBe('https://www.youtube.com/@mychannel');
  });

  it('keeps @ when handle already starts with @', () => {
    expect(buildAccountProfileUrl('youtube', '@mychannel')).toBe('https://www.youtube.com/@mychannel');
  });

  it('handles multi-word channel names with no @', () => {
    expect(buildAccountProfileUrl('youtube', 'MrBeast')).toBe('https://www.youtube.com/@MrBeast');
  });
});

describe('buildAccountProfileUrl() — tiktok', () => {
  it('normalizes handle without @ to tiktok URL', () => {
    expect(buildAccountProfileUrl('tiktok', 'creator')).toBe('https://www.tiktok.com/@creator');
  });

  it('strips leading @ and re-adds it cleanly', () => {
    expect(buildAccountProfileUrl('tiktok', '@creator')).toBe('https://www.tiktok.com/@creator');
  });

  it('does not double-prepend @@ for handles with @', () => {
    const result = buildAccountProfileUrl('tiktok', '@user');
    expect(result).toBe('https://www.tiktok.com/@user');
    expect(result).not.toContain('@@');
  });
});

describe('buildAccountProfileUrl() — instagram', () => {
  it('strips leading @ from handle', () => {
    expect(buildAccountProfileUrl('instagram', '@photo')).toBe('https://www.instagram.com/photo/');
  });

  it('passes handle without @ through unchanged', () => {
    expect(buildAccountProfileUrl('instagram', 'photo')).toBe('https://www.instagram.com/photo/');
  });

  it('ends with trailing slash', () => {
    const url = buildAccountProfileUrl('instagram', 'test');
    expect(url.endsWith('/')).toBe(true);
  });
});
