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

  it('returns false for empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('returns false for an unknown platform', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
    expect(isOAuthPlatform('twitter')).toBe(false);
    expect(isOAuthPlatform('linkedin')).toBe(false);
  });

  it('is case-sensitive (rejects uppercase variants)', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
    expect(isOAuthPlatform('TIKTOK')).toBe(false);
    expect(isOAuthPlatform('Facebook')).toBe(false);
    expect(isOAuthPlatform('Canva')).toBe(false);
  });

  it('returns false for partial platform names', () => {
    expect(isOAuthPlatform('you')).toBe(false);
    expect(isOAuthPlatform('tik')).toBe(false);
  });

  it('returns false for values with extra whitespace', () => {
    expect(isOAuthPlatform(' youtube')).toBe(false);
    expect(isOAuthPlatform('youtube ')).toBe(false);
  });
});
