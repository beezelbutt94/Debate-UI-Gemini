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

  it('returns false for an unknown platform', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('returns false for a random string', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('returns false for capitalized variant', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
  });

  it('returns false for partial match', () => {
    expect(isOAuthPlatform('you')).toBe(false);
  });

  it('returns false for "tiktok " with trailing space', () => {
    expect(isOAuthPlatform('tiktok ')).toBe(false);
  });

  it('covers all four valid platforms exhaustively', () => {
    const valid = ['youtube', 'tiktok', 'facebook', 'canva'];
    for (const p of valid) {
      expect(isOAuthPlatform(p)).toBe(true);
    }
  });
});
