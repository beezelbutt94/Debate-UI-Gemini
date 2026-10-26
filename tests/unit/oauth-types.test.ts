import { describe, it, expect } from 'vitest';
import { isOAuthPlatform, getOAuthProvider } from '@/lib/oauth/index';

describe('isOAuthPlatform()', () => {
  it('accepts youtube', () => {
    expect(isOAuthPlatform('youtube')).toBe(true);
  });

  it('accepts tiktok', () => {
    expect(isOAuthPlatform('tiktok')).toBe(true);
  });

  it('accepts facebook', () => {
    expect(isOAuthPlatform('facebook')).toBe(true);
  });

  it('accepts canva', () => {
    expect(isOAuthPlatform('canva')).toBe(true);
  });

  it('rejects instagram', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('rejects uppercase variant', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
  });

  it('rejects arbitrary string', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('rejects numeric string', () => {
    expect(isOAuthPlatform('123')).toBe(false);
  });

  it('rejects platform with trailing space', () => {
    expect(isOAuthPlatform('youtube ')).toBe(false);
  });
});

describe('getOAuthProvider()', () => {
  it('returns provider with requiresPkce=false for youtube', () => {
    const p = getOAuthProvider('youtube');
    expect(p.requiresPkce).toBe(false);
  });

  it('returns provider with requiresPkce=false for tiktok', () => {
    const p = getOAuthProvider('tiktok');
    expect(p.requiresPkce).toBe(false);
  });

  it('returns provider with requiresPkce=false for facebook', () => {
    const p = getOAuthProvider('facebook');
    expect(p.requiresPkce).toBe(false);
  });

  it('returns provider with requiresPkce=true for canva', () => {
    const p = getOAuthProvider('canva');
    expect(p.requiresPkce).toBe(true);
  });

  it('returns an object with authorizationUrl method for all platforms', () => {
    for (const platform of ['youtube', 'tiktok', 'facebook', 'canva'] as const) {
      const p = getOAuthProvider(platform);
      expect(typeof p.authorizationUrl).toBe('function');
    }
  });

  it('returns an object with exchangeCode method for all platforms', () => {
    for (const platform of ['youtube', 'tiktok', 'facebook', 'canva'] as const) {
      const p = getOAuthProvider(platform);
      expect(typeof p.exchangeCode).toBe('function');
    }
  });

  it('returns an object with refreshAccessToken method for all platforms', () => {
    for (const platform of ['youtube', 'tiktok', 'facebook', 'canva'] as const) {
      const p = getOAuthProvider(platform);
      expect(typeof p.refreshAccessToken).toBe('function');
    }
  });
});
