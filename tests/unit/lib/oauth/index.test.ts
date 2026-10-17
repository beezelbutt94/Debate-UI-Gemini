import { describe, it, expect } from 'vitest';
import { getOAuthProvider, isOAuthPlatform } from '@/lib/oauth';

describe('getOAuthProvider()', () => {
  it('returns an object for youtube', () => {
    const provider = getOAuthProvider('youtube');
    expect(provider).toBeDefined();
    expect(typeof provider).toBe('object');
  });

  it('returns an object for tiktok', () => {
    const provider = getOAuthProvider('tiktok');
    expect(provider).toBeDefined();
  });

  it('returns an object for facebook', () => {
    const provider = getOAuthProvider('facebook');
    expect(provider).toBeDefined();
  });

  it('returns an object for canva', () => {
    const provider = getOAuthProvider('canva');
    expect(provider).toBeDefined();
  });

  it('provider has authorizationUrl function', () => {
    const provider = getOAuthProvider('youtube');
    expect(typeof provider.authorizationUrl).toBe('function');
  });

  it('provider has exchangeCode function', () => {
    const provider = getOAuthProvider('tiktok');
    expect(typeof provider.exchangeCode).toBe('function');
  });

  it('provider has refreshAccessToken function', () => {
    const provider = getOAuthProvider('facebook');
    expect(typeof provider.refreshAccessToken).toBe('function');
  });

  it('provider has requiresPkce boolean', () => {
    const provider = getOAuthProvider('canva');
    expect(typeof provider.requiresPkce).toBe('boolean');
  });

  it('canva provider requires PKCE', () => {
    expect(getOAuthProvider('canva').requiresPkce).toBe(true);
  });

  it('youtube provider does not require PKCE', () => {
    expect(getOAuthProvider('youtube').requiresPkce).toBe(false);
  });

  it('tiktok provider does not require PKCE', () => {
    expect(getOAuthProvider('tiktok').requiresPkce).toBe(false);
  });

  it('facebook provider does not require PKCE', () => {
    expect(getOAuthProvider('facebook').requiresPkce).toBe(false);
  });

  it('returns different provider objects for different platforms', () => {
    const youtube = getOAuthProvider('youtube');
    const tiktok = getOAuthProvider('tiktok');
    expect(youtube).not.toBe(tiktok);
  });

  it('youtube authorizationUrl builds a google accounts URL (throws without env)', () => {
    const provider = getOAuthProvider('youtube');
    expect(() => provider.authorizationUrl({ state: 'test', redirectUri: 'http://localhost/cb' })).toThrow();
  });

  it('tiktok authorizationUrl throws without env vars', () => {
    const provider = getOAuthProvider('tiktok');
    expect(() => provider.authorizationUrl({ state: 'test', redirectUri: 'http://localhost/cb' })).toThrow();
  });
});
