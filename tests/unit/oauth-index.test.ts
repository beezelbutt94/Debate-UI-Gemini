import { describe, it, expect } from 'vitest';
import { getOAuthProvider } from '@/lib/oauth';

describe('getOAuthProvider', () => {
  it('returns a provider object for youtube', () => {
    const provider = getOAuthProvider('youtube');
    expect(provider).toBeDefined();
    expect(typeof provider.authorizationUrl).toBe('function');
    expect(typeof provider.exchangeCode).toBe('function');
    expect(typeof provider.refreshAccessToken).toBe('function');
  });

  it('returns a provider object for tiktok', () => {
    const provider = getOAuthProvider('tiktok');
    expect(provider).toBeDefined();
    expect(typeof provider.authorizationUrl).toBe('function');
  });

  it('returns a provider object for facebook', () => {
    const provider = getOAuthProvider('facebook');
    expect(provider).toBeDefined();
    expect(typeof provider.authorizationUrl).toBe('function');
  });

  it('returns a provider object for canva', () => {
    const provider = getOAuthProvider('canva');
    expect(provider).toBeDefined();
    expect(typeof provider.authorizationUrl).toBe('function');
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
