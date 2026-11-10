import { describe, it, expect } from 'vitest';
import { getOAuthProvider } from '@/lib/oauth';

describe('getOAuthProvider', () => {
  const platforms = ['youtube', 'tiktok', 'facebook', 'canva'] as const;

  for (const platform of platforms) {
    it(`returns a provider object for "${platform}"`, () => {
      const provider = getOAuthProvider(platform);
      expect(provider).toBeDefined();
      expect(typeof provider.authorizationUrl).toBe('function');
      expect(typeof provider.exchangeCode).toBe('function');
      expect(typeof provider.refreshAccessToken).toBe('function');
      expect(typeof provider.requiresPkce).toBe('boolean');
    });
  }

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

  it('youtube authorizationUrl throws when env var is missing', () => {
    const saved = process.env.YOUTUBE_OAUTH_CLIENT_ID;
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    try {
      expect(() =>
        getOAuthProvider('youtube').authorizationUrl({
          state: 'st',
          redirectUri: 'https://example.com/callback',
        })
      ).toThrow('YOUTUBE_OAUTH_CLIENT_ID');
    } finally {
      if (saved !== undefined) process.env.YOUTUBE_OAUTH_CLIENT_ID = saved;
    }
  });

  it('tiktok authorizationUrl throws when env var is missing', () => {
    const saved = process.env.TIKTOK_OAUTH_CLIENT_KEY;
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    try {
      expect(() =>
        getOAuthProvider('tiktok').authorizationUrl({
          state: 'st',
          redirectUri: 'https://example.com/callback',
        })
      ).toThrow('TIKTOK_OAUTH_CLIENT_KEY');
    } finally {
      if (saved !== undefined) process.env.TIKTOK_OAUTH_CLIENT_KEY = saved;
    }
  });

  it('facebook authorizationUrl throws when env var is missing', () => {
    const saved = process.env.FACEBOOK_APP_ID;
    delete process.env.FACEBOOK_APP_ID;
    try {
      expect(() =>
        getOAuthProvider('facebook').authorizationUrl({
          state: 'st',
          redirectUri: 'https://example.com/callback',
        })
      ).toThrow('FACEBOOK_APP_ID');
    } finally {
      if (saved !== undefined) process.env.FACEBOOK_APP_ID = saved;
    }
  });

  it('canva authorizationUrl throws when env var is missing', () => {
    const saved = process.env.CANVA_CLIENT_ID;
    delete process.env.CANVA_CLIENT_ID;
    try {
      expect(() =>
        getOAuthProvider('canva').authorizationUrl({
          state: 'st',
          redirectUri: 'https://example.com/callback',
          codeChallenge: 'challenge',
        })
      ).toThrow('CANVA_CLIENT_ID');
    } finally {
      if (saved !== undefined) process.env.CANVA_CLIENT_ID = saved;
    }
  });

  it('youtube authorizationUrl builds a valid URL with correct params', () => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'test-client-id';
    try {
      const url = new URL(
        getOAuthProvider('youtube').authorizationUrl({
          state: 'mystate',
          redirectUri: 'https://app.example.com/callback',
        })
      );
      expect(url.hostname).toBe('accounts.google.com');
      expect(url.searchParams.get('client_id')).toBe('test-client-id');
      expect(url.searchParams.get('state')).toBe('mystate');
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('access_type')).toBe('offline');
      expect(url.searchParams.get('prompt')).toBe('consent');
      expect(url.searchParams.get('redirect_uri')).toBe('https://app.example.com/callback');
    } finally {
      delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    }
  });

  it('tiktok authorizationUrl builds a valid URL with correct params', () => {
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'tiktok-key';
    try {
      const url = new URL(
        getOAuthProvider('tiktok').authorizationUrl({
          state: 'tstate',
          redirectUri: 'https://app.example.com/callback',
        })
      );
      expect(url.hostname).toBe('www.tiktok.com');
      expect(url.searchParams.get('client_key')).toBe('tiktok-key');
      expect(url.searchParams.get('state')).toBe('tstate');
      expect(url.searchParams.get('scope')).toBe('video.publish');
    } finally {
      delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    }
  });

  it('facebook authorizationUrl builds a valid URL with correct params', () => {
    process.env.FACEBOOK_APP_ID = 'fb-app-id';
    try {
      const url = new URL(
        getOAuthProvider('facebook').authorizationUrl({
          state: 'fbstate',
          redirectUri: 'https://app.example.com/callback',
        })
      );
      expect(url.hostname).toBe('www.facebook.com');
      expect(url.searchParams.get('client_id')).toBe('fb-app-id');
      expect(url.searchParams.get('state')).toBe('fbstate');
      expect(url.searchParams.get('response_type')).toBe('code');
    } finally {
      delete process.env.FACEBOOK_APP_ID;
    }
  });

  it('canva authorizationUrl embeds code_challenge and S256 method', () => {
    process.env.CANVA_CLIENT_ID = 'canva-id';
    try {
      const url = new URL(
        getOAuthProvider('canva').authorizationUrl({
          state: 'cstate',
          redirectUri: 'https://app.example.com/callback',
          codeChallenge: 'mychallenge',
        })
      );
      expect(url.hostname).toBe('www.canva.com');
      expect(url.searchParams.get('code_challenge')).toBe('mychallenge');
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    } finally {
      delete process.env.CANVA_CLIENT_ID;
    }
  });
});
