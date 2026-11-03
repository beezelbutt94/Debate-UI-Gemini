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

  it('returns false for "instagram" (not in OAuth platform list)', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('returns false for "Twitter"', () => {
    expect(isOAuthPlatform('Twitter')).toBe(false);
  });

  it('returns false for "YouTube" (wrong case)', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
  });

  it('returns false for "TIKTOK" (wrong case)', () => {
    expect(isOAuthPlatform('TIKTOK')).toBe(false);
  });

  it('returns false for a random string', () => {
    expect(isOAuthPlatform('random-platform-xyz')).toBe(false);
  });

  it('returns false for a numeric string', () => {
    expect(isOAuthPlatform('123')).toBe(false);
  });

  it('returns false for "facebook_reels" (content platform, not OAuth platform)', () => {
    expect(isOAuthPlatform('facebook_reels')).toBe(false);
  });

  it('returns false for "youtube_shorts" (content platform, not OAuth platform)', () => {
    expect(isOAuthPlatform('youtube_shorts')).toBe(false);
  });
});
