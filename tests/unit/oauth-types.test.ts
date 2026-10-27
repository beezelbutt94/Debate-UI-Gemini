import { describe, it, expect } from 'vitest';
import { isOAuthPlatform } from '@/lib/oauth/types';

describe('isOAuthPlatform()', () => {
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
  it('returns false for "instagram"', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('returns false for "twitter"', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('returns false for uppercase "YOUTUBE"', () => {
    expect(isOAuthPlatform('YOUTUBE')).toBe(false);
  });

  it('returns false for partial match "you"', () => {
    expect(isOAuthPlatform('you')).toBe(false);
  });

  it('returns false for "tiktok " (trailing space)', () => {
    expect(isOAuthPlatform('tiktok ')).toBe(false);
  });

  it('returns false for numeric string', () => {
    expect(isOAuthPlatform('123')).toBe(false);
  });

  it('returns false for "youtube_shorts" (content platform, not OAuth)', () => {
    expect(isOAuthPlatform('youtube_shorts')).toBe(false);
  });

  it('returns false for "facebook_reels" (content platform, not OAuth)', () => {
    expect(isOAuthPlatform('facebook_reels')).toBe(false);
  });
});
