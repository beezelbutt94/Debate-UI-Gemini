import { describe, it, expect } from 'vitest';
import { isOAuthPlatform } from '@/lib/oauth/types';

describe('isOAuthPlatform', () => {
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

  it('returns false for an unrelated platform string', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('returns false for "twitter"', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('returns false for "YouTube" (case-sensitive)', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
  });

  it('returns false for "TikTok" (case-sensitive)', () => {
    expect(isOAuthPlatform('TikTok')).toBe(false);
  });

  it('returns false for "Facebook" (case-sensitive)', () => {
    expect(isOAuthPlatform('Facebook')).toBe(false);
  });

  it('returns false for "Canva" (case-sensitive)', () => {
    expect(isOAuthPlatform('Canva')).toBe(false);
  });

  it('returns false for "tiktok " (trailing space)', () => {
    expect(isOAuthPlatform('tiktok ')).toBe(false);
  });

  it('returns false for a numeric string', () => {
    expect(isOAuthPlatform('123')).toBe(false);
  });

  it('returns false for "youtube_shorts"', () => {
    // youtube_shorts is a Platform (video type), NOT an OAuthPlatform
    expect(isOAuthPlatform('youtube_shorts')).toBe(false);
  });

  it('returns false for "facebook_reels"', () => {
    expect(isOAuthPlatform('facebook_reels')).toBe(false);
  });
});
