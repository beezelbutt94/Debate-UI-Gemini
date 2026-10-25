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

  it('rejects "instagram"', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('rejects "twitter"', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('rejects "YOUTUBE" (case-sensitive)', () => {
    expect(isOAuthPlatform('YOUTUBE')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('rejects a numeric string', () => {
    expect(isOAuthPlatform('123')).toBe(false);
  });

  it('rejects "youtube " (trailing space)', () => {
    expect(isOAuthPlatform('youtube ')).toBe(false);
  });
});
