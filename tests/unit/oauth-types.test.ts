import { describe, it, expect } from 'vitest';
import { isOAuthPlatform } from '@/lib/oauth/types';

describe('isOAuthPlatform()', () => {
  it('returns true for "youtube"', () => {
    expect(isOAuthPlatform('youtube')).toBe(true);
  });

  it('returns true for "tiktok"', () => {
    expect(isOAuthPlatform('tiktok')).toBe(true);
  });

  it('returns true for "facebook"', () => {
    expect(isOAuthPlatform('facebook')).toBe(true);
  });

  it('returns true for "canva"', () => {
    expect(isOAuthPlatform('canva')).toBe(true);
  });

  it('returns false for "instagram" (not a supported OAuth platform)', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('is case-sensitive: "YouTube" is not a valid platform', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
  });

  it('is case-sensitive: "TIKTOK" is not a valid platform', () => {
    expect(isOAuthPlatform('TIKTOK')).toBe(false);
  });

  it('returns false for an arbitrary random string', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
    expect(isOAuthPlatform('snapchat')).toBe(false);
  });

  it('returns false for "facebook_reels" (that is a content Platform, not an OAuth platform)', () => {
    expect(isOAuthPlatform('facebook_reels')).toBe(false);
  });

  it('returns false for "youtube_shorts"', () => {
    expect(isOAuthPlatform('youtube_shorts')).toBe(false);
  });
});
