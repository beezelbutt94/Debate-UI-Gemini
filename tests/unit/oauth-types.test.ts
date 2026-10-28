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

  it('returns false for "twitter"', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('returns false for "YouTube" (wrong case)', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
  });

  it('returns false for "TIKTOK" (wrong case)', () => {
    expect(isOAuthPlatform('TIKTOK')).toBe(false);
  });

  it('returns false for a string with whitespace padding', () => {
    expect(isOAuthPlatform(' youtube ')).toBe(false);
  });

  it('returns false for a random string', () => {
    expect(isOAuthPlatform('random-platform')).toBe(false);
  });

  it('all four valid platforms recognised', () => {
    const valid = ['youtube', 'tiktok', 'facebook', 'canva'];
    expect(valid.every(isOAuthPlatform)).toBe(true);
  });
});
