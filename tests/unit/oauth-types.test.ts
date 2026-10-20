import { describe, it, expect } from 'vitest';
import { isOAuthPlatform } from '@/lib/oauth/types';

describe('isOAuthPlatform', () => {
  // Valid platforms
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

  // Invalid platforms
  it('returns false for "instagram" (not in OAuthPlatform union)', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('returns false for uppercase "YOUTUBE"', () => {
    expect(isOAuthPlatform('YOUTUBE')).toBe(false);
  });

  it('returns false for uppercase "TIKTOK"', () => {
    expect(isOAuthPlatform('TIKTOK')).toBe(false);
  });

  it('returns false for mixed case "YouTube"', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('returns false for a random string', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('returns false for a string with leading space', () => {
    expect(isOAuthPlatform(' youtube')).toBe(false);
  });

  it('returns false for "youtube_shorts" (a content platform, not OAuth platform)', () => {
    expect(isOAuthPlatform('youtube_shorts')).toBe(false);
  });

  it('returns false for "facebook_reels"', () => {
    expect(isOAuthPlatform('facebook_reels')).toBe(false);
  });

  it('returns false for "tiktok_business"', () => {
    expect(isOAuthPlatform('tiktok_business')).toBe(false);
  });
});
