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

  it('returns false for an unrecognized platform', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('returns false for a platform not in the list', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('is case-sensitive: returns false for "YouTube" (uppercase)', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
  });

  it('is case-sensitive: returns false for "TikTok"', () => {
    expect(isOAuthPlatform('TikTok')).toBe(false);
  });

  it('is case-sensitive: returns false for "Facebook"', () => {
    expect(isOAuthPlatform('Facebook')).toBe(false);
  });

  it('is case-sensitive: returns false for "Canva"', () => {
    expect(isOAuthPlatform('Canva')).toBe(false);
  });

  it('returns false for a random string', () => {
    expect(isOAuthPlatform('random-platform')).toBe(false);
  });

  it('returns false for a numeric string', () => {
    expect(isOAuthPlatform('123')).toBe(false);
  });
});
