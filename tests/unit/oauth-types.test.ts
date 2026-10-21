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

  it('rejects "instagram" (not an OAuth platform in this app)', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('rejects "twitter"', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('rejects a numeric string', () => {
    expect(isOAuthPlatform('123')).toBe(false);
  });

  it('rejects a mixed-case variant', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
    expect(isOAuthPlatform('TikTok')).toBe(false);
    expect(isOAuthPlatform('FACEBOOK')).toBe(false);
  });

  it('rejects a substring of a valid platform', () => {
    expect(isOAuthPlatform('you')).toBe(false);
    expect(isOAuthPlatform('tik')).toBe(false);
  });

  it('rejects whitespace variations', () => {
    expect(isOAuthPlatform(' youtube')).toBe(false);
    expect(isOAuthPlatform('youtube ')).toBe(false);
  });
});
