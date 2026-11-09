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

  it('returns false for an empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('returns false for "instagram" (not a connectable OAuth platform)', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('returns false for "twitter"', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('returns false for a numeric string', () => {
    expect(isOAuthPlatform('123')).toBe(false);
  });

  it('is case-sensitive: "YouTube" (mixed case) returns false', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
  });

  it('is case-sensitive: "TIKTOK" returns false', () => {
    expect(isOAuthPlatform('TIKTOK')).toBe(false);
  });

  it('returns false for "facebook_reels" (that is a Platform, not an OAuthPlatform)', () => {
    expect(isOAuthPlatform('facebook_reels')).toBe(false);
  });

  it('returns false for "youtube_shorts"', () => {
    expect(isOAuthPlatform('youtube_shorts')).toBe(false);
  });

  it('returns false for a string with trailing whitespace', () => {
    expect(isOAuthPlatform('youtube ')).toBe(false);
  });

  it('returns false for a string with leading whitespace', () => {
    expect(isOAuthPlatform(' tiktok')).toBe(false);
  });
});
