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

  it('rejects empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('rejects uppercase variant', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
  });

  it('rejects partial match', () => {
    expect(isOAuthPlatform('you')).toBe(false);
  });

  it('rejects arbitrary string', () => {
    expect(isOAuthPlatform('whatever')).toBe(false);
  });
});
