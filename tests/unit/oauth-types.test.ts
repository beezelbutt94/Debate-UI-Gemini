import { describe, it, expect } from 'vitest';
import { isOAuthPlatform, getOAuthProvider } from '@/lib/oauth/index';

describe('isOAuthPlatform()', () => {
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

  it('returns false for instagram', () => {
    expect(isOAuthPlatform('instagram')).toBe(false);
  });

  it('returns false for twitter', () => {
    expect(isOAuthPlatform('twitter')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isOAuthPlatform('')).toBe(false);
  });

  it('returns false for uppercase variant', () => {
    expect(isOAuthPlatform('YouTube')).toBe(false);
    expect(isOAuthPlatform('TIKTOK')).toBe(false);
  });

  it('returns false for arbitrary string', () => {
    expect(isOAuthPlatform('random-platform')).toBe(false);
  });

  it('returns false for youtube_shorts (content platform, not OAuth platform)', () => {
    expect(isOAuthPlatform('youtube_shorts')).toBe(false);
  });

  it('returns false for partial match', () => {
    expect(isOAuthPlatform('you')).toBe(false);
    expect(isOAuthPlatform('tik')).toBe(false);
  });
});

describe('getOAuthProvider()', () => {
  it('returns provider for youtube', () => {
    const p = getOAuthProvider('youtube');
    expect(p).toBeDefined();
    expect(typeof p.authorizationUrl).toBe('function');
    expect(typeof p.exchangeCode).toBe('function');
    expect(typeof p.refreshAccessToken).toBe('function');
  });

  it('returns provider for tiktok', () => {
    const p = getOAuthProvider('tiktok');
    expect(p).toBeDefined();
    expect(typeof p.authorizationUrl).toBe('function');
  });

  it('returns provider for facebook', () => {
    const p = getOAuthProvider('facebook');
    expect(p).toBeDefined();
    expect(typeof p.authorizationUrl).toBe('function');
  });

  it('returns provider for canva', () => {
    const p = getOAuthProvider('canva');
    expect(p).toBeDefined();
    expect(typeof p.authorizationUrl).toBe('function');
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

  it('canva provider requires PKCE', () => {
    expect(getOAuthProvider('canva').requiresPkce).toBe(true);
  });

  it('returns the same provider object on repeated calls (referential stability)', () => {
    expect(getOAuthProvider('youtube')).toBe(getOAuthProvider('youtube'));
    expect(getOAuthProvider('tiktok')).toBe(getOAuthProvider('tiktok'));
  });
});

describe('OAuthProvider.authorizationUrl()', () => {
  const baseParams = {
    state: 'test-state-abc123',
    redirectUri: 'https://app.example.com/api/oauth/callback/youtube',
  };

  it('youtube authorizationUrl contains required OAuth2 params', () => {
    // Env vars are read at call time — inject them
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'yt-client-id';
    const url = new URL(getOAuthProvider('youtube').authorizationUrl(baseParams));
    expect(url.hostname).toBe('accounts.google.com');
    expect(url.searchParams.get('state')).toBe(baseParams.state);
    expect(url.searchParams.get('redirect_uri')).toBe(baseParams.redirectUri);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('access_type')).toBe('offline');
    expect(url.searchParams.get('prompt')).toBe('consent');
    expect(url.searchParams.get('client_id')).toBe('yt-client-id');
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
  });

  it('tiktok authorizationUrl contains required OAuth2 params', () => {
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'tt-client-key';
    const params = { ...baseParams, redirectUri: 'https://app.example.com/api/oauth/callback/tiktok' };
    const url = new URL(getOAuthProvider('tiktok').authorizationUrl(params));
    expect(url.hostname).toBe('www.tiktok.com');
    expect(url.searchParams.get('state')).toBe(baseParams.state);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_key')).toBe('tt-client-key');
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
  });

  it('facebook authorizationUrl contains required OAuth2 params', () => {
    process.env.FACEBOOK_APP_ID = 'fb-app-id';
    const params = { ...baseParams, redirectUri: 'https://app.example.com/api/oauth/callback/facebook' };
    const url = new URL(getOAuthProvider('facebook').authorizationUrl(params));
    expect(url.hostname).toBe('www.facebook.com');
    expect(url.searchParams.get('state')).toBe(baseParams.state);
    expect(url.searchParams.get('response_type')).toBe('code');
    expect(url.searchParams.get('client_id')).toBe('fb-app-id');
    delete process.env.FACEBOOK_APP_ID;
  });

  it('canva authorizationUrl contains required OAuth2+PKCE params', () => {
    process.env.CANVA_CLIENT_ID = 'canva-client-id';
    const params = {
      ...baseParams,
      redirectUri: 'https://app.example.com/api/oauth/callback/canva',
      codeChallenge: 'test-challenge-abc',
    };
    const url = new URL(getOAuthProvider('canva').authorizationUrl(params));
    expect(url.hostname).toBe('www.canva.com');
    expect(url.searchParams.get('state')).toBe(baseParams.state);
    expect(url.searchParams.get('code_challenge')).toBe('test-challenge-abc');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('response_type')).toBe('code');
    delete process.env.CANVA_CLIENT_ID;
  });

  it('youtube authorizationUrl throws when env var is missing', () => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    expect(() => getOAuthProvider('youtube').authorizationUrl(baseParams)).toThrow(
      'YOUTUBE_OAUTH_CLIENT_ID'
    );
  });

  it('tiktok authorizationUrl throws when env var is missing', () => {
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    expect(() =>
      getOAuthProvider('tiktok').authorizationUrl({ ...baseParams, redirectUri: 'https://x.com/cb' })
    ).toThrow('TIKTOK_OAUTH_CLIENT_KEY');
  });

  it('facebook authorizationUrl throws when env var is missing', () => {
    delete process.env.FACEBOOK_APP_ID;
    expect(() =>
      getOAuthProvider('facebook').authorizationUrl({ ...baseParams, redirectUri: 'https://x.com/cb' })
    ).toThrow('FACEBOOK_APP_ID');
  });

  it('canva authorizationUrl throws when env var is missing', () => {
    delete process.env.CANVA_CLIENT_ID;
    expect(() =>
      getOAuthProvider('canva').authorizationUrl({ ...baseParams, redirectUri: 'https://x.com/cb' })
    ).toThrow('CANVA_CLIENT_ID');
  });
});
