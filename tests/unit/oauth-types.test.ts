import { describe, it, expect } from 'vitest';
import { isOAuthPlatform } from '@/lib/oauth/types';

describe('isOAuthPlatform()', () => {
  it('accepts "youtube"', () => {
    expect(isOAuthPlatform('youtube')).toBe(true);
  });

  it('accepts "tiktok"', () => {
    expect(isOAuthPlatform('tiktok')).toBe(true);
  });

  it('accepts "facebook"', () => {
    expect(isOAuthPlatform('facebook')).toBe(true);
  });

  it('accepts "canva"', () => {
    expect(isOAuthPlatform('canva')).toBe(true);
  });

  it('rejects "instagram" (not a supported OAuth platform)', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('rejects uppercase "YouTube"', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
  });

  it('rejects uppercase "TIKTOK"', () => {
    expect(isOAuthPlatform('TIKTOK')).toBe(false);
  });

  it('rejects uppercase "FACEBOOK"', () => {
    expect(isOAuthPlatform('FACEBOOK')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('rejects an arbitrary string', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
    expect(isOAuthPlatform('google')).toBe(false);
    expect(isOAuthPlatform('linkedin')).toBe(false);
  });

  it('rejects strings with extra whitespace', () => {
    expect(isOAuthPlatform(' youtube')).toBe(false);
    expect(isOAuthPlatform('youtube ')).toBe(false);
  });
});
