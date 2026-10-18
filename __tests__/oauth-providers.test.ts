/**
 * Tests for all four OAuth provider modules.
 * Each provider is imported fresh per suite so process.env stubs don't bleed.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stubEnv(vars: Record<string, string>) {
  const originals: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    originals[k] = process.env[k];
    process.env[k] = v;
  }
  return () => {
    for (const [k, orig] of Object.entries(originals)) {
      if (orig === undefined) delete process.env[k];
      else process.env[k] = orig;
    }
  };
}

function mockFetch(...responses: Array<{ ok: boolean; status?: number; body?: unknown; text?: string }>) {
  let idx = 0;
  return vi.fn(async () => {
    const r = responses[idx] ?? responses[responses.length - 1];
    idx++;
    return {
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 500),
      json: async () => r.body ?? {},
      text: async () => r.text ?? JSON.stringify(r.body ?? {}),
    };
  });
}

// ---------------------------------------------------------------------------
// YouTube
// ---------------------------------------------------------------------------
describe('youtubeProvider', () => {
  let restoreEnv: () => void;

  beforeEach(() => {
    vi.resetModules();
    restoreEnv = stubEnv({
      YOUTUBE_OAUTH_CLIENT_ID: 'yt-client-id',
      YOUTUBE_OAUTH_CLIENT_SECRET: 'yt-client-secret',
    });
  });

  afterEach(() => {
    restoreEnv();
    vi.restoreAllMocks();
  });

  it('requiresPkce is false', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    expect(youtubeProvider.requiresPkce).toBe(false);
  });

  it('authorizationUrl builds a valid Google OAuth URL', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const url = youtubeProvider.authorizationUrl({
      state: 'test-state',
      redirectUri: 'https://example.com/callback',
    });
    const parsed = new URL(url);
    expect(parsed.hostname).toBe('accounts.google.com');
    expect(parsed.searchParams.get('client_id')).toBe('yt-client-id');
    expect(parsed.searchParams.get('state')).toBe('test-state');
    expect(parsed.searchParams.get('redirect_uri')).toBe('https://example.com/callback');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('access_type')).toBe('offline');
    expect(parsed.searchParams.get('prompt')).toBe('consent');
  });

  it('authorizationUrl throws when env var is missing', async () => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    expect(() =>
      youtubeProvider.authorizationUrl({ state: 's', redirectUri: 'https://example.com/cb' })
    ).toThrow('YOUTUBE_OAUTH_CLIENT_ID');
  });

  it('exchangeCode returns a TokenExchangeResult on success', async () => {
    const channelBody = { items: [{ id: 'UC123', snippet: { title: 'My Channel' } }] };
    const fetch = mockFetch(
      { ok: true, body: { access_token: 'at', refresh_token: 'rt', expires_in: 3600, scope: 'yt-scope' } },
      { ok: true, body: channelBody }
    );
    vi.stubGlobal('fetch', fetch);
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const result = await youtubeProvider.exchangeCode({ code: 'code123', redirectUri: 'https://example.com/cb' });
    expect(result.accessToken).toBe('at');
    expect(result.refreshToken).toBe('rt');
    expect(result.externalAccountId).toBe('UC123');
    expect(result.externalAccountLabel).toBe('My Channel');
    expect(result.scope).toBe('yt-scope');
    expect(result.expiresAt).toBeTruthy();
  });

  it('exchangeCode throws if token exchange HTTP fails', async () => {
    const fetch = mockFetch({ ok: false, status: 400, text: 'bad request' });
    vi.stubGlobal('fetch', fetch);
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    await expect(
      youtubeProvider.exchangeCode({ code: 'bad', redirectUri: 'https://example.com/cb' })
    ).rejects.toThrow('YouTube token exchange failed');
  });

  it('exchangeCode throws if no refresh_token in response', async () => {
    const fetch = mockFetch(
      { ok: true, body: { access_token: 'at', expires_in: 3600, scope: 'yt' } }
    );
    vi.stubGlobal('fetch', fetch);
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    await expect(
      youtubeProvider.exchangeCode({ code: 'code', redirectUri: 'https://example.com/cb' })
    ).rejects.toThrow('refresh_token');
  });

  it('exchangeCode handles missing channel (null externalAccountId)', async () => {
    const fetch = mockFetch(
      { ok: true, body: { access_token: 'at', refresh_token: 'rt', expires_in: 3600, scope: 'yt' } },
      { ok: false, status: 403 }   // channel fetch fails → null
    );
    vi.stubGlobal('fetch', fetch);
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const result = await youtubeProvider.exchangeCode({ code: 'c', redirectUri: 'https://example.com/cb' });
    expect(result.externalAccountId).toBeNull();
  });

  it('exchangeCode handles fetchOwnChannel throwing (catch branch → null)', async () => {
    let callIndex = 0;
    const fetch = vi.fn(async () => {
      callIndex++;
      if (callIndex === 1) {
        // token exchange succeeds
        return { ok: true, status: 200, json: async () => ({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, scope: 'yt' }), text: async () => '' };
      }
      throw new Error('network error fetching channel');
    });
    vi.stubGlobal('fetch', fetch);
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const result = await youtubeProvider.exchangeCode({ code: 'c', redirectUri: 'https://example.com/cb' });
    expect(result.externalAccountId).toBeNull();
  });

  it('exchangeCode handles channel response with no items (null)', async () => {
    const fetch = mockFetch(
      { ok: true, body: { access_token: 'at', refresh_token: 'rt', expires_in: 3600, scope: 'yt' } },
      { ok: true, body: { items: [] } }
    );
    vi.stubGlobal('fetch', fetch);
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const result = await youtubeProvider.exchangeCode({ code: 'c', redirectUri: 'https://example.com/cb' });
    expect(result.externalAccountId).toBeNull();
  });

  it('exchangeCode uses channel id as title when snippet.title is missing', async () => {
    const fetch = mockFetch(
      { ok: true, body: { access_token: 'at', refresh_token: 'rt', expires_in: 3600, scope: 'yt' } },
      { ok: true, body: { items: [{ id: 'UC-no-title', snippet: {} }] } }
    );
    vi.stubGlobal('fetch', fetch);
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const result = await youtubeProvider.exchangeCode({ code: 'c', redirectUri: 'https://example.com/cb' });
    expect(result.externalAccountLabel).toBe('UC-no-title');
  });

  it('exchangeCode falls back to UPLOAD_SCOPE constant when scope absent from response', async () => {
    // Covers: body.scope ?? UPLOAD_SCOPE → UPLOAD_SCOPE branch (line 63)
    const fetch = mockFetch(
      { ok: true, body: { access_token: 'at', refresh_token: 'rt', expires_in: 3600 } },
      { ok: true, body: { items: [{ id: 'UC1', snippet: { title: 'Chan' } }] } }
    );
    vi.stubGlobal('fetch', fetch);
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const result = await youtubeProvider.exchangeCode({ code: 'c', redirectUri: 'https://example.com/cb' });
    expect(result.scope).toBe('https://www.googleapis.com/auth/youtube.upload');
  });

  it('refreshAccessToken returns a new access token', async () => {
    const fetch = mockFetch({ ok: true, body: { access_token: 'new-at', expires_in: 3600 } });
    vi.stubGlobal('fetch', fetch);
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const result = await youtubeProvider.refreshAccessToken('old-rt');
    expect(result.accessToken).toBe('new-at');
    expect(result.expiresAt).toBeTruthy();
    expect(result.refreshToken).toBeNull(); // Google didn't rotate
  });

  it('refreshAccessToken returns rotated refresh token when provided', async () => {
    const fetch = mockFetch({
      ok: true,
      body: { access_token: 'new-at', expires_in: 3600, refresh_token: 'new-rt' },
    });
    vi.stubGlobal('fetch', fetch);
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const result = await youtubeProvider.refreshAccessToken('old-rt');
    expect(result.refreshToken).toBe('new-rt');
  });

  it('refreshAccessToken throws on HTTP failure', async () => {
    const fetch = mockFetch({ ok: false, status: 401, text: 'unauthorized' });
    vi.stubGlobal('fetch', fetch);
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    await expect(youtubeProvider.refreshAccessToken('bad-rt')).rejects.toThrow('YouTube token refresh failed');
  });
});

// ---------------------------------------------------------------------------
// TikTok
// ---------------------------------------------------------------------------
describe('tiktokProvider', () => {
  let restoreEnv: () => void;

  beforeEach(() => {
    vi.resetModules();
    restoreEnv = stubEnv({
      TIKTOK_OAUTH_CLIENT_KEY: 'tt-key',
      TIKTOK_OAUTH_CLIENT_SECRET: 'tt-secret',
    });
  });

  afterEach(() => {
    restoreEnv();
    vi.restoreAllMocks();
  });

  it('requiresPkce is false', async () => {
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    expect(tiktokProvider.requiresPkce).toBe(false);
  });

  it('authorizationUrl builds a valid TikTok OAuth URL', async () => {
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const url = tiktokProvider.authorizationUrl({ state: 'st', redirectUri: 'https://example.com/cb' });
    const parsed = new URL(url);
    expect(parsed.hostname).toBe('www.tiktok.com');
    expect(parsed.searchParams.get('client_key')).toBe('tt-key');
    expect(parsed.searchParams.get('state')).toBe('st');
    expect(parsed.searchParams.get('response_type')).toBe('code');
  });

  it('authorizationUrl throws when env var is missing', async () => {
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    expect(() =>
      tiktokProvider.authorizationUrl({ state: 's', redirectUri: 'https://example.com/cb' })
    ).toThrow('TIKTOK_OAUTH_CLIENT_KEY');
  });

  it('exchangeCode returns a TokenExchangeResult on success', async () => {
    const fetch = mockFetch(
      { ok: true, body: { access_token: 'at', refresh_token: 'rt', expires_in: 86400, open_id: 'uid-1', scope: 'video.publish' } },
      { ok: true, body: { data: { user: { display_name: 'TT User' } } } }
    );
    vi.stubGlobal('fetch', fetch);
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const result = await tiktokProvider.exchangeCode({ code: 'c', redirectUri: 'https://example.com/cb' });
    expect(result.accessToken).toBe('at');
    expect(result.refreshToken).toBe('rt');
    expect(result.externalAccountId).toBe('uid-1');
    expect(result.externalAccountLabel).toBe('TT User');
    expect(result.scope).toBe('video.publish');
  });

  it('exchangeCode throws if response has error field', async () => {
    const fetch = mockFetch({ ok: true, body: { error: 'invalid_client', error_description: 'bad creds' } });
    vi.stubGlobal('fetch', fetch);
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    await expect(
      tiktokProvider.exchangeCode({ code: 'c', redirectUri: 'https://example.com/cb' })
    ).rejects.toThrow('TikTok token exchange failed');
  });

  it('exchangeCode throws on HTTP error', async () => {
    const fetch = mockFetch({ ok: false, status: 400, body: { error: 'bad' } });
    vi.stubGlobal('fetch', fetch);
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    await expect(
      tiktokProvider.exchangeCode({ code: 'c', redirectUri: 'https://example.com/cb' })
    ).rejects.toThrow('TikTok token exchange failed');
  });

  it('exchangeCode handles null display name when user fetch fails', async () => {
    const fetch = mockFetch(
      { ok: true, body: { access_token: 'at', refresh_token: 'rt', open_id: 'uid', scope: 'v' } },
      { ok: false, status: 403 }
    );
    vi.stubGlobal('fetch', fetch);
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const result = await tiktokProvider.exchangeCode({ code: 'c', redirectUri: 'https://example.com/cb' });
    expect(result.externalAccountLabel).toBeNull();
  });

  it('exchangeCode handles fetchDisplayName throwing (catch branch → null)', async () => {
    let callIndex = 0;
    const fetch = vi.fn(async () => {
      callIndex++;
      if (callIndex === 1) {
        return { ok: true, status: 200, json: async () => ({ access_token: 'at', refresh_token: 'rt', open_id: 'uid', scope: 'v' }), text: async () => '' };
      }
      throw new Error('network error');
    });
    vi.stubGlobal('fetch', fetch);
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const result = await tiktokProvider.exchangeCode({ code: 'c', redirectUri: 'https://example.com/cb' });
    expect(result.externalAccountLabel).toBeNull();
  });

  it('exchangeCode handles missing expires_in (null expiresAt)', async () => {
    const fetch = mockFetch(
      { ok: true, body: { access_token: 'at', refresh_token: 'rt', open_id: 'uid', scope: 'v' } },
      { ok: true, body: { data: { user: { display_name: 'U' } } } }
    );
    vi.stubGlobal('fetch', fetch);
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const result = await tiktokProvider.exchangeCode({ code: 'c', redirectUri: 'https://example.com/cb' });
    expect(result.expiresAt).toBeNull();
  });

  it('exchangeCode uses null for missing refresh_token, open_id; uses scope fallback', async () => {
    // Covers ?? null branches at lines 56, 58, 60
    const fetch = mockFetch(
      { ok: true, body: { access_token: 'at', expires_in: 3600 } },
      { ok: true, body: { data: { user: { display_name: 'U' } } } }
    );
    vi.stubGlobal('fetch', fetch);
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const result = await tiktokProvider.exchangeCode({ code: 'c', redirectUri: 'https://example.com/cb' });
    expect(result.refreshToken).toBeNull();
    expect(result.externalAccountId).toBeNull();
    expect(result.scope).toBe('video.publish'); // fallback constant
  });

  it('exchangeCode handles display_name body present but field absent', async () => {
    // Covers: body?.data?.user?.display_name ?? null → null branch
    const fetch = mockFetch(
      { ok: true, body: { access_token: 'at', refresh_token: 'rt', open_id: 'uid', scope: 'v' } },
      { ok: true, body: { data: { user: {} } } }  // no display_name
    );
    vi.stubGlobal('fetch', fetch);
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const result = await tiktokProvider.exchangeCode({ code: 'c', redirectUri: 'https://example.com/cb' });
    expect(result.externalAccountLabel).toBeNull();
  });

  it('refreshAccessToken returns refreshed token', async () => {
    const fetch = mockFetch({ ok: true, body: { access_token: 'new-at', expires_in: 3600 } });
    vi.stubGlobal('fetch', fetch);
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const result = await tiktokProvider.refreshAccessToken('old-rt');
    expect(result.accessToken).toBe('new-at');
  });

  it('refreshAccessToken returns null expiresAt when expires_in absent', async () => {
    // Covers: body.expires_in ? ... : null → null branch in refreshAccessToken (line 86)
    const fetch = mockFetch({ ok: true, body: { access_token: 'new-at' } });
    vi.stubGlobal('fetch', fetch);
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const result = await tiktokProvider.refreshAccessToken('old-rt');
    expect(result.expiresAt).toBeNull();
  });

  it('refreshAccessToken throws on error', async () => {
    const fetch = mockFetch({ ok: false, status: 401, body: { error: 'expired' } });
    vi.stubGlobal('fetch', fetch);
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    await expect(tiktokProvider.refreshAccessToken('bad-rt')).rejects.toThrow('TikTok token refresh failed');
  });
});

// ---------------------------------------------------------------------------
// Facebook
// ---------------------------------------------------------------------------
describe('facebookProvider', () => {
  let restoreEnv: () => void;

  beforeEach(() => {
    vi.resetModules();
    restoreEnv = stubEnv({
      FACEBOOK_APP_ID: 'fb-app-id',
      FACEBOOK_APP_SECRET: 'fb-app-secret',
    });
  });

  afterEach(() => {
    restoreEnv();
    vi.restoreAllMocks();
  });

  it('requiresPkce is false', async () => {
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    expect(facebookProvider.requiresPkce).toBe(false);
  });

  it('authorizationUrl builds a valid Facebook dialog URL', async () => {
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    const url = facebookProvider.authorizationUrl({ state: 'st', redirectUri: 'https://example.com/cb' });
    const parsed = new URL(url);
    expect(parsed.hostname).toBe('www.facebook.com');
    expect(parsed.searchParams.get('client_id')).toBe('fb-app-id');
    expect(parsed.searchParams.get('state')).toBe('st');
    expect(parsed.searchParams.get('response_type')).toBe('code');
  });

  it('authorizationUrl throws when env var is missing', async () => {
    delete process.env.FACEBOOK_APP_ID;
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    expect(() =>
      facebookProvider.authorizationUrl({ state: 's', redirectUri: 'https://example.com/cb' })
    ).toThrow('FACEBOOK_APP_ID');
  });

  it('exchangeCode returns a TokenExchangeResult with Page tokens', async () => {
    const fetch = mockFetch(
      // short-lived token exchange
      { ok: true, body: { access_token: 'short-at' } },
      // long-lived token exchange
      { ok: true, body: { access_token: 'long-at' } },
      // /me/accounts
      { ok: true, body: { data: [{ id: 'page-1', name: 'My Page', access_token: 'page-at' }] } }
    );
    vi.stubGlobal('fetch', fetch);
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    const result = await facebookProvider.exchangeCode({ code: 'c', redirectUri: 'https://example.com/cb' });
    expect(result.accessToken).toBe('page-at');
    expect(result.refreshToken).toBe('long-at');
    expect(result.externalAccountId).toBe('page-1');
    expect(result.externalAccountLabel).toBe('My Page');
    expect(result.expiresAt).toBeNull();
  });

  it('exchangeCode throws when short-lived token exchange returns no access_token', async () => {
    const fetch = mockFetch({ ok: true, body: {} });
    vi.stubGlobal('fetch', fetch);
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    await expect(
      facebookProvider.exchangeCode({ code: 'c', redirectUri: 'https://example.com/cb' })
    ).rejects.toThrow('no access_token');
  });

  it('exchangeCode throws when long-lived exchange returns no access_token', async () => {
    const fetch = mockFetch(
      { ok: true, body: { access_token: 'short-at' } },
      { ok: true, body: {} } // no long-lived token
    );
    vi.stubGlobal('fetch', fetch);
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    await expect(
      facebookProvider.exchangeCode({ code: 'c', redirectUri: 'https://example.com/cb' })
    ).rejects.toThrow('long-lived token exchange failed');
  });

  it('exchangeCode throws when no Page is found', async () => {
    const fetch = mockFetch(
      { ok: true, body: { access_token: 'short-at' } },
      { ok: true, body: { access_token: 'long-at' } },
      { ok: true, body: { data: [] } }  // empty pages list
    );
    vi.stubGlobal('fetch', fetch);
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    await expect(
      facebookProvider.exchangeCode({ code: 'c', redirectUri: 'https://example.com/cb' })
    ).rejects.toThrow('no Pages');
  });

  it('refreshAccessToken re-derives page token from long-lived user token', async () => {
    const fetch = mockFetch(
      { ok: true, body: { data: [{ id: 'page-1', name: 'My Page', access_token: 'page-at-2' }] } }
    );
    vi.stubGlobal('fetch', fetch);
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    const result = await facebookProvider.refreshAccessToken('long-user-token');
    expect(result.accessToken).toBe('page-at-2');
    expect(result.expiresAt).toBeNull();
    expect(result.refreshToken).toBeNull();
  });

  it('refreshAccessToken throws when long-lived token is expired', async () => {
    const fetch = mockFetch({ ok: true, body: { data: [] } });
    vi.stubGlobal('fetch', fetch);
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    await expect(facebookProvider.refreshAccessToken('expired-token')).rejects.toThrow(
      're-derivation failed'
    );
  });

  it('exchangeCode throws when Graph API returns an error body', async () => {
    const fetch = mockFetch(
      // short-lived token exchange: Graph API returns HTTP 200 but body has error field
      { ok: true, body: { error: { message: 'invalid code', type: 'OAuthException' } } }
    );
    vi.stubGlobal('fetch', fetch);
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    await expect(
      facebookProvider.exchangeCode({ code: 'c', redirectUri: 'https://example.com/cb' })
    ).rejects.toThrow('Facebook Graph API call failed');
  });

  it('exchangeCode uses page id as name when page entry has no name field', async () => {
    // Covers: first.name ?? first.id → first.id branch (line 98)
    const fetch = mockFetch(
      { ok: true, body: { access_token: 'short-at' } },
      { ok: true, body: { access_token: 'long-at' } },
      { ok: true, body: { data: [{ id: 'page-no-name', access_token: 'page-at' }] } }
    );
    vi.stubGlobal('fetch', fetch);
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    const result = await facebookProvider.exchangeCode({ code: 'c', redirectUri: 'https://example.com/cb' });
    expect(result.externalAccountLabel).toBe('page-no-name');
  });
});

// ---------------------------------------------------------------------------
// Canva
// ---------------------------------------------------------------------------
describe('canvaProvider', () => {
  let restoreEnv: () => void;

  beforeEach(() => {
    vi.resetModules();
    restoreEnv = stubEnv({
      CANVA_CLIENT_ID: 'canva-id',
      CANVA_CLIENT_SECRET: 'canva-secret',
    });
  });

  afterEach(() => {
    restoreEnv();
    vi.restoreAllMocks();
  });

  it('requiresPkce is true', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    expect(canvaProvider.requiresPkce).toBe(true);
  });

  it('authorizationUrl builds a valid Canva OAuth URL with PKCE', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const url = canvaProvider.authorizationUrl({
      state: 'st',
      redirectUri: 'https://example.com/cb',
      codeChallenge: 'ch',
    });
    const parsed = new URL(url);
    expect(parsed.hostname).toBe('www.canva.com');
    expect(parsed.searchParams.get('client_id')).toBe('canva-id');
    expect(parsed.searchParams.get('state')).toBe('st');
    expect(parsed.searchParams.get('code_challenge')).toBe('ch');
    expect(parsed.searchParams.get('code_challenge_method')).toBe('S256');
    expect(parsed.searchParams.get('response_type')).toBe('code');
  });

  it('authorizationUrl throws when CANVA_CLIENT_ID is missing', async () => {
    delete process.env.CANVA_CLIENT_ID;
    const { canvaProvider } = await import('@/lib/oauth/canva');
    expect(() =>
      canvaProvider.authorizationUrl({ state: 's', redirectUri: 'https://example.com/cb' })
    ).toThrow('CANVA_CLIENT_ID');
  });

  it('authorizationUrl sets code_challenge to empty string when omitted', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const url = canvaProvider.authorizationUrl({ state: 'st', redirectUri: 'https://example.com/cb' });
    const parsed = new URL(url);
    expect(parsed.searchParams.get('code_challenge')).toBe('');
  });

  it('exchangeCode returns a TokenExchangeResult on success', async () => {
    const fetch = mockFetch(
      { ok: true, body: { access_token: 'at', refresh_token: 'rt', expires_in: 1800, scope: 'design:content:write' } },
      { ok: true, body: { display_name: 'Canva User' } }
    );
    vi.stubGlobal('fetch', fetch);
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const result = await canvaProvider.exchangeCode({ code: 'c', redirectUri: 'https://example.com/cb', codeVerifier: 'v' });
    expect(result.accessToken).toBe('at');
    expect(result.refreshToken).toBe('rt');
    expect(result.externalAccountId).toBeNull(); // Canva doesn't expose a stable user id
    expect(result.externalAccountLabel).toBe('Canva User');
    expect(result.scope).toBe('design:content:write');
    expect(result.expiresAt).toBeTruthy();
  });

  it('exchangeCode throws on HTTP error', async () => {
    const fetch = mockFetch({ ok: false, status: 400, text: 'bad request' });
    vi.stubGlobal('fetch', fetch);
    const { canvaProvider } = await import('@/lib/oauth/canva');
    await expect(
      canvaProvider.exchangeCode({ code: 'c', redirectUri: 'https://example.com/cb' })
    ).rejects.toThrow('Canva token exchange failed');
  });

  it('exchangeCode handles null display_name when profile fetch fails', async () => {
    const fetch = mockFetch(
      { ok: true, body: { access_token: 'at', refresh_token: 'rt', expires_in: 1800, scope: 'design:content:write' } },
      { ok: false, status: 403 }
    );
    vi.stubGlobal('fetch', fetch);
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const result = await canvaProvider.exchangeCode({ code: 'c', redirectUri: 'https://example.com/cb' });
    expect(result.externalAccountLabel).toBeNull();
  });

  it('exchangeCode uses null for missing refresh_token and scope fallback', async () => {
    // No refresh_token or scope in exchange response → covers ?? branches
    const fetch = mockFetch(
      { ok: true, body: { access_token: 'at', expires_in: 1800 } },
      { ok: true, body: { display_name: 'U' } }
    );
    vi.stubGlobal('fetch', fetch);
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const result = await canvaProvider.exchangeCode({ code: 'c', redirectUri: 'https://example.com/cb' });
    expect(result.refreshToken).toBeNull();
    expect(result.scope).toContain('design'); // fallback SCOPES constant
  });

  it('exchangeCode handles profile body with no display_name property', async () => {
    const fetch = mockFetch(
      { ok: true, body: { access_token: 'at', expires_in: 1800 } },
      { ok: true, body: {} }  // body present but no display_name
    );
    vi.stubGlobal('fetch', fetch);
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const result = await canvaProvider.exchangeCode({ code: 'c', redirectUri: 'https://example.com/cb' });
    expect(result.externalAccountLabel).toBeNull();
  });

  it('exchangeCode handles fetchDisplayName throwing (catch branch → null)', async () => {
    let callIndex = 0;
    const fetch = vi.fn(async () => {
      callIndex++;
      if (callIndex === 1) {
        return { ok: true, status: 200, json: async () => ({ access_token: 'at', refresh_token: 'rt', expires_in: 1800, scope: 'design:content:write' }), text: async () => '' };
      }
      throw new Error('network error');
    });
    vi.stubGlobal('fetch', fetch);
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const result = await canvaProvider.exchangeCode({ code: 'c', redirectUri: 'https://example.com/cb' });
    expect(result.externalAccountLabel).toBeNull();
  });

  it('refreshAccessToken returns a new access token', async () => {
    const fetch = mockFetch({ ok: true, body: { access_token: 'new-at', expires_in: 1800, refresh_token: 'new-rt' } });
    vi.stubGlobal('fetch', fetch);
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const result = await canvaProvider.refreshAccessToken('old-rt');
    expect(result.accessToken).toBe('new-at');
    expect(result.refreshToken).toBe('new-rt');
    expect(result.expiresAt).toBeTruthy();
  });

  it('refreshAccessToken returns null refreshToken when not in response', async () => {
    // Covers: (body.refresh_token as string | undefined) ?? null → null branch
    const fetch = mockFetch({ ok: true, body: { access_token: 'new-at', expires_in: 1800 } });
    vi.stubGlobal('fetch', fetch);
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const result = await canvaProvider.refreshAccessToken('old-rt');
    expect(result.refreshToken).toBeNull();
  });

  it('refreshAccessToken throws on HTTP error', async () => {
    const fetch = mockFetch({ ok: false, status: 401, text: 'unauthorized' });
    vi.stubGlobal('fetch', fetch);
    const { canvaProvider } = await import('@/lib/oauth/canva');
    await expect(canvaProvider.refreshAccessToken('bad-rt')).rejects.toThrow('Canva token refresh failed');
  });
});
