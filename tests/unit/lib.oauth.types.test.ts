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

  it('returns false for "instagram"', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('returns false for "Twitter"', () => {
    expect(isOAuthPlatform('Twitter')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('returns false for "YouTube" (case-sensitive)', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
  });

  it('returns false for a random string', () => {
    expect(isOAuthPlatform('snapchat')).toBe(false);
  });

  it('returns false for a numeric string', () => {
    expect(isOAuthPlatform('123')).toBe(false);
  });
});
