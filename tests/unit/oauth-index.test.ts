import { describe, it, expect } from 'vitest';
import { getOAuthProvider } from '@/lib/oauth';

describe('getOAuthProvider()', () => {
  it('returns an object with the required interface for youtube', () => {
    const p = getOAuthProvider('youtube');
    expect(typeof p.authorizationUrl).toBe('function');
    expect(typeof p.exchangeCode).toBe('function');
    expect(typeof p.refreshAccessToken).toBe('function');
    expect(typeof p.requiresPkce).toBe('boolean');
  });

  it('returns an object with the required interface for tiktok', () => {
    const p = getOAuthProvider('tiktok');
    expect(typeof p.authorizationUrl).toBe('function');
    expect(typeof p.exchangeCode).toBe('function');
    expect(typeof p.refreshAccessToken).toBe('function');
  });

  it('returns an object with the required interface for facebook', () => {
    const p = getOAuthProvider('facebook');
    expect(typeof p.authorizationUrl).toBe('function');
    expect(typeof p.exchangeCode).toBe('function');
    expect(typeof p.refreshAccessToken).toBe('function');
  });

  it('returns an object with the required interface for canva', () => {
    const p = getOAuthProvider('canva');
    expect(typeof p.authorizationUrl).toBe('function');
    expect(typeof p.exchangeCode).toBe('function');
    expect(typeof p.refreshAccessToken).toBe('function');
  });

  it('youtube does NOT require PKCE', () => {
    expect(getOAuthProvider('youtube').requiresPkce).toBe(false);
  });

  it('tiktok does NOT require PKCE', () => {
    expect(getOAuthProvider('tiktok').requiresPkce).toBe(false);
  });

  it('facebook does NOT require PKCE', () => {
    expect(getOAuthProvider('facebook').requiresPkce).toBe(false);
  });

  it('canva DOES require PKCE', () => {
    expect(getOAuthProvider('canva').requiresPkce).toBe(true);
  });

  // Authorization URL shape tests (no network calls, just URL building)
  // These exercise the env-var branch too — they should throw when env is missing.
  it('youtube authorizationUrl throws when YOUTUBE_OAUTH_CLIENT_ID is not set', () => {
    const p = getOAuthProvider('youtube');
    expect(() =>
      p.authorizationUrl({ state: 'st', redirectUri: 'https://example.com/callback' })
    ).toThrow('YOUTUBE_OAUTH_CLIENT_ID');
  });

  it('tiktok authorizationUrl throws when TIKTOK_OAUTH_CLIENT_KEY is not set', () => {
    const p = getOAuthProvider('tiktok');
    expect(() =>
      p.authorizationUrl({ state: 'st', redirectUri: 'https://example.com/callback' })
    ).toThrow('TIKTOK_OAUTH_CLIENT_KEY');
  });

  it('facebook authorizationUrl throws when FACEBOOK_APP_ID is not set', () => {
    const p = getOAuthProvider('facebook');
    expect(() =>
      p.authorizationUrl({ state: 'st', redirectUri: 'https://example.com/callback' })
    ).toThrow('FACEBOOK_APP_ID');
  });

  it('canva authorizationUrl throws when CANVA_CLIENT_ID is not set', () => {
    const p = getOAuthProvider('canva');
    expect(() =>
      p.authorizationUrl({ state: 'st', redirectUri: 'https://example.com/callback', codeChallenge: 'ch' })
    ).toThrow('CANVA_CLIENT_ID');
  });
});
