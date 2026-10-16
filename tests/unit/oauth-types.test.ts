import { describe, it, expect } from 'vitest';
import { isOAuthPlatform, getOAuthProvider } from '@/lib/oauth';

describe('isOAuthPlatform', () => {
  it('returns true for youtube', () => {
    expect(isOAuthPlatform('youtube')).toBe(true);
  });

  it('returns true for tiktok', () => {
    expect(isOAuthPlatform('tiktok')).toBe(true);
  });

  it('returns true for facebook', () => {
    expect(isOAuthPlatform('facebook')).toBe(true);
  });

  it('returns true for canva', () => {
    expect(isOAuthPlatform('canva')).toBe(true);
  });

  it('returns false for an unknown string', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('returns false for a near-miss (extra chars)', () => {
    expect(isOAuthPlatform('youtube2')).toBe(false);
  });

  it('returns false for uppercase YOUTUBE', () => {
    expect(isOAuthPlatform('YOUTUBE')).toBe(false);
  });

  it('returns false for Twitter', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });
});

describe('getOAuthProvider', () => {
  it('returns a provider for youtube', () => {
    const p = getOAuthProvider('youtube');
    expect(p).toBeDefined();
    expect(typeof p.authorizationUrl).toBe('function');
    expect(typeof p.exchangeCode).toBe('function');
    expect(typeof p.refreshAccessToken).toBe('function');
  });

  it('returns a provider for tiktok', () => {
    const p = getOAuthProvider('tiktok');
    expect(p).toBeDefined();
    expect(typeof p.authorizationUrl).toBe('function');
  });

  it('returns a provider for facebook', () => {
    const p = getOAuthProvider('facebook');
    expect(p).toBeDefined();
    expect(typeof p.authorizationUrl).toBe('function');
  });

  it('returns a provider for canva', () => {
    const p = getOAuthProvider('canva');
    expect(p).toBeDefined();
    expect(typeof p.authorizationUrl).toBe('function');
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
});
