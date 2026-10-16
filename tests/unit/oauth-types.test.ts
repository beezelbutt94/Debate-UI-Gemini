import { describe, it, expect } from 'vitest';
import { isOAuthPlatform } from '@/lib/oauth/types';
import { getOAuthProvider } from '@/lib/oauth';

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

  it('returns false for an empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('returns false for a random string', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('returns false for "YouTube" (wrong casing)', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
  });

  it('returns false for "TikTok" (wrong casing)', () => {
    expect(isOAuthPlatform('TikTok')).toBe(false);
  });

  it('returns false for "Facebook" (wrong casing)', () => {
    expect(isOAuthPlatform('Facebook')).toBe(false);
  });

  it('returns false for "Canva" (wrong casing)', () => {
    expect(isOAuthPlatform('Canva')).toBe(false);
  });

  it('returns false for a numeric string', () => {
    expect(isOAuthPlatform('123')).toBe(false);
  });
});

describe('getOAuthProvider()', () => {
  it('returns a provider with requiresPkce for canva (true)', () => {
    expect(getOAuthProvider('canva').requiresPkce).toBe(true);
  });

  it('returns a provider with requiresPkce for youtube (false)', () => {
    expect(getOAuthProvider('youtube').requiresPkce).toBe(false);
  });

  it('returns a provider with requiresPkce for tiktok (false)', () => {
    expect(getOAuthProvider('tiktok').requiresPkce).toBe(false);
  });

  it('returns a provider with requiresPkce for facebook (false)', () => {
    expect(getOAuthProvider('facebook').requiresPkce).toBe(false);
  });

  it('each provider has an authorizationUrl function', () => {
    for (const platform of ['youtube', 'tiktok', 'facebook', 'canva'] as const) {
      expect(typeof getOAuthProvider(platform).authorizationUrl).toBe('function');
    }
  });

  it('each provider has an exchangeCode function', () => {
    for (const platform of ['youtube', 'tiktok', 'facebook', 'canva'] as const) {
      expect(typeof getOAuthProvider(platform).exchangeCode).toBe('function');
    }
  });

  it('each provider has a refreshAccessToken function', () => {
    for (const platform of ['youtube', 'tiktok', 'facebook', 'canva'] as const) {
      expect(typeof getOAuthProvider(platform).refreshAccessToken).toBe('function');
    }
  });
});
