import { describe, it, expect } from 'vitest';
import { isOAuthPlatform } from '@/lib/oauth/types';
import { getOAuthProvider } from '@/lib/oauth';

describe('isOAuthPlatform', () => {
  it('returns true for youtube', () => expect(isOAuthPlatform('youtube')).toBe(true));
  it('returns true for tiktok', () => expect(isOAuthPlatform('tiktok')).toBe(true));
  it('returns true for facebook', () => expect(isOAuthPlatform('facebook')).toBe(true));
  it('returns true for canva', () => expect(isOAuthPlatform('canva')).toBe(true));

  it('returns false for unknown strings', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
    expect(isOAuthPlatform('twitter')).toBe(false);
    expect(isOAuthPlatform('')).toBe(false);
    expect(isOAuthPlatform('YOUTUBE')).toBe(false); // case-sensitive
  });
});

describe('getOAuthProvider', () => {
  it('returns a provider object for youtube', () => {
    const p = getOAuthProvider('youtube');
    expect(typeof p.authorizationUrl).toBe('function');
    expect(typeof p.exchangeCode).toBe('function');
    expect(typeof p.refreshAccessToken).toBe('function');
  });

  it('returns a provider object for tiktok', () => {
    const p = getOAuthProvider('tiktok');
    expect(typeof p.authorizationUrl).toBe('function');
  });

  it('returns a provider object for facebook', () => {
    const p = getOAuthProvider('facebook');
    expect(typeof p.authorizationUrl).toBe('function');
  });

  it('returns a provider object for canva with requiresPkce=true', () => {
    const p = getOAuthProvider('canva');
    expect(p.requiresPkce).toBe(true);
  });

  it('youtube and tiktok providers do not require PKCE', () => {
    expect(getOAuthProvider('youtube').requiresPkce).toBe(false);
    expect(getOAuthProvider('tiktok').requiresPkce).toBe(false);
    expect(getOAuthProvider('facebook').requiresPkce).toBe(false);
  });
});
