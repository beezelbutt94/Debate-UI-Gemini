import { describe, it, expect } from 'vitest';
import { isOAuthPlatform } from '@/lib/oauth/types';

describe('isOAuthPlatform', () => {
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

  it('rejects an empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('rejects arbitrary strings', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
    expect(isOAuthPlatform('snapchat')).toBe(false);
    expect(isOAuthPlatform('Pinterest')).toBe(false);
  });

  it('is case-sensitive — rejects uppercase variants', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
    expect(isOAuthPlatform('TIKTOK')).toBe(false);
    expect(isOAuthPlatform('Facebook')).toBe(false);
    expect(isOAuthPlatform('Canva')).toBe(false);
  });
});
