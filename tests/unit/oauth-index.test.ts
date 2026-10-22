import { describe, it, expect } from 'vitest';
import { getOAuthProvider } from '@/lib/oauth/index';

describe('getOAuthProvider', () => {
  it('returns a provider for youtube', () => {
    const provider = getOAuthProvider('youtube');
    expect(provider).toBeDefined();
  });

  it('returns a provider for tiktok', () => {
    const provider = getOAuthProvider('tiktok');
    expect(provider).toBeDefined();
  });

  it('returns a provider for facebook', () => {
    const provider = getOAuthProvider('facebook');
    expect(provider).toBeDefined();
  });

  it('returns a provider for canva', () => {
    const provider = getOAuthProvider('canva');
    expect(provider).toBeDefined();
  });

  it('each provider has requiresPkce boolean', () => {
    for (const platform of ['youtube', 'tiktok', 'facebook', 'canva'] as const) {
      expect(typeof getOAuthProvider(platform).requiresPkce).toBe('boolean');
    }
  });

  it('only canva requiresPkce', () => {
    expect(getOAuthProvider('canva').requiresPkce).toBe(true);
    expect(getOAuthProvider('youtube').requiresPkce).toBe(false);
    expect(getOAuthProvider('tiktok').requiresPkce).toBe(false);
    expect(getOAuthProvider('facebook').requiresPkce).toBe(false);
  });

  it('each provider has authorizationUrl function', () => {
    for (const platform of ['youtube', 'tiktok', 'facebook', 'canva'] as const) {
      expect(typeof getOAuthProvider(platform).authorizationUrl).toBe('function');
    }
  });

  it('each provider has exchangeCode function', () => {
    for (const platform of ['youtube', 'tiktok', 'facebook', 'canva'] as const) {
      expect(typeof getOAuthProvider(platform).exchangeCode).toBe('function');
    }
  });

  it('each provider has refreshAccessToken function', () => {
    for (const platform of ['youtube', 'tiktok', 'facebook', 'canva'] as const) {
      expect(typeof getOAuthProvider(platform).refreshAccessToken).toBe('function');
    }
  });

  it('returns the same provider object on repeated calls (referential equality)', () => {
    expect(getOAuthProvider('youtube')).toBe(getOAuthProvider('youtube'));
    expect(getOAuthProvider('tiktok')).toBe(getOAuthProvider('tiktok'));
  });
});

// ─── YouTube authorizationUrl (no env vars needed for URL construction) ───────

describe('youtube authorizationUrl', () => {
  const OLD_ENV = { ...process.env };

  it('throws when YOUTUBE_OAUTH_CLIENT_ID is unset', () => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    const provider = getOAuthProvider('youtube');
    expect(() =>
      provider.authorizationUrl({ state: 'st', redirectUri: 'https://example.com/cb' })
    ).toThrow('YOUTUBE_OAUTH_CLIENT_ID');
    Object.assign(process.env, OLD_ENV);
  });

  it('builds a valid accounts.google.com URL when env is set', () => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'test-client-id';
    const provider = getOAuthProvider('youtube');
    const url = provider.authorizationUrl({ state: 'mystate', redirectUri: 'https://example.com/cb' });
    expect(url).toContain('accounts.google.com');
    expect(url).toContain('state=mystate');
    expect(url).toContain('client_id=test-client-id');
    expect(url).toContain('access_type=offline');
    expect(url).toContain('prompt=consent');
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
  });
});

// ─── TikTok authorizationUrl ──────────────────────────────────────────────────

describe('tiktok authorizationUrl', () => {
  it('throws when TIKTOK_OAUTH_CLIENT_KEY is unset', () => {
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    const provider = getOAuthProvider('tiktok');
    expect(() =>
      provider.authorizationUrl({ state: 'st', redirectUri: 'https://example.com/cb' })
    ).toThrow('TIKTOK_OAUTH_CLIENT_KEY');
  });

  it('builds a tiktok.com authorize URL when env is set', () => {
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'test-tiktok-key';
    const provider = getOAuthProvider('tiktok');
    const url = provider.authorizationUrl({ state: 'mystate', redirectUri: 'https://example.com/cb' });
    expect(url).toContain('tiktok.com');
    expect(url).toContain('state=mystate');
    expect(url).toContain('client_key=test-tiktok-key');
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
  });
});

// ─── Facebook authorizationUrl ────────────────────────────────────────────────

describe('facebook authorizationUrl', () => {
  it('throws when FACEBOOK_APP_ID is unset', () => {
    delete process.env.FACEBOOK_APP_ID;
    const provider = getOAuthProvider('facebook');
    expect(() =>
      provider.authorizationUrl({ state: 'st', redirectUri: 'https://example.com/cb' })
    ).toThrow('FACEBOOK_APP_ID');
  });

  it('builds a facebook.com oauth URL when env is set', () => {
    process.env.FACEBOOK_APP_ID = 'test-app-id';
    const provider = getOAuthProvider('facebook');
    const url = provider.authorizationUrl({ state: 'mystate', redirectUri: 'https://example.com/cb' });
    expect(url).toContain('facebook.com');
    expect(url).toContain('state=mystate');
    expect(url).toContain('client_id=test-app-id');
    delete process.env.FACEBOOK_APP_ID;
  });
});

// ─── Canva authorizationUrl (requires PKCE) ───────────────────────────────────

describe('canva authorizationUrl', () => {
  it('throws when CANVA_CLIENT_ID is unset', () => {
    delete process.env.CANVA_CLIENT_ID;
    const provider = getOAuthProvider('canva');
    expect(() =>
      provider.authorizationUrl({ state: 'st', redirectUri: 'https://example.com/cb', codeChallenge: 'ch' })
    ).toThrow('CANVA_CLIENT_ID');
  });

  it('builds a canva.com authorize URL with PKCE params when env is set', () => {
    process.env.CANVA_CLIENT_ID = 'test-canva-id';
    const provider = getOAuthProvider('canva');
    const url = provider.authorizationUrl({
      state: 'mystate',
      redirectUri: 'https://example.com/cb',
      codeChallenge: 'mychallenge',
    });
    expect(url).toContain('canva.com');
    expect(url).toContain('state=mystate');
    expect(url).toContain('code_challenge=mychallenge');
    expect(url).toContain('code_challenge_method=S256');
    delete process.env.CANVA_CLIENT_ID;
  });
});
