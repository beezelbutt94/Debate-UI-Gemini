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

  it('returns false for an unsupported platform string', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('returns false for a random word', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('returns false for uppercase variant', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
  });

  it('returns false for a numeric string', () => {
    expect(isOAuthPlatform('123')).toBe(false);
  });

  it('is case-sensitive — "TIKTOK" is not valid', () => {
    expect(isOAuthPlatform('TIKTOK')).toBe(false);
  });
});
