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

  it('returns false for an unknown platform', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('returns false for a mixed-case variant', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
    expect(isOAuthPlatform('TikTok')).toBe(false);
    expect(isOAuthPlatform('FACEBOOK')).toBe(false);
  });

  it('returns false for a string that contains a valid platform but is not exact', () => {
    expect(isOAuthPlatform('youtube_shorts')).toBe(false);
    expect(isOAuthPlatform('tiktok_for_business')).toBe(false);
  });

  it('returns false for random strings', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
    expect(isOAuthPlatform('linkedin')).toBe(false);
    expect(isOAuthPlatform('spotify')).toBe(false);
  });
});
