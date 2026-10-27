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

  it('returns false for "instagram"', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('returns false for "twitter"', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('returns false for "YOUTUBE" (case-sensitive)', () => {
    expect(isOAuthPlatform('YOUTUBE')).toBe(false);
  });

  it('returns false for "TikTok" (mixed case)', () => {
    expect(isOAuthPlatform('TikTok')).toBe(false);
  });

  it('returns false for random string', () => {
    expect(isOAuthPlatform('randomplatform')).toBe(false);
  });

  it('returns false for whitespace', () => {
    expect(isOAuthPlatform(' ')).toBe(false);
  });

  it('returns false for "youtube " (trailing space)', () => {
    expect(isOAuthPlatform('youtube ')).toBe(false);
  });

  it('all four valid platforms return true', () => {
    const valid = ['youtube', 'tiktok', 'facebook', 'canva'];
    for (const p of valid) {
      expect(isOAuthPlatform(p)).toBe(true);
    }
  });
});
