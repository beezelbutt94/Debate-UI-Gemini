import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── helpers ──────────────────────────────────────────────────────────────────

type FakeResponse = {
  ok: boolean;
  status?: number;
  body?: unknown;
  text?: string;
};

function makeFetchMock(responses: FakeResponse[]) {
  let call = 0;
  return vi.fn().mockImplementation(async () => {
    const r = responses[call] ?? responses[responses.length - 1];
    call++;
    const status = r.status ?? (r.ok ? 200 : 400);
    return {
      ok: r.ok,
      status,
      json: async () => r.body ?? {},
      text: async () => r.text ?? JSON.stringify(r.body ?? {}),
    };
  });
}

// ── YouTube provider ─────────────────────────────────────────────────────────

describe('youtubeProvider', () => {
  beforeEach(() => {
    vi.stubEnv('YOUTUBE_OAUTH_CLIENT_ID', 'yt-client-id');
    vi.stubEnv('YOUTUBE_OAUTH_CLIENT_SECRET', 'yt-client-secret');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('requiresPkce is false', async () => {
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    expect(youtubeProvider.requiresPkce).toBe(false);
  });

  describe('authorizationUrl()', () => {
    it('returns a valid https URL', async () => {
      const { youtubeProvider } = await import('@/lib/oauth/youtube');
      const url = youtubeProvider.authorizationUrl({ state: 's1', redirectUri: 'https://app.example.com/cb' });
      expect(() => new URL(url)).not.toThrow();
      expect(url).toMatch(/^https:\/\//);
    });

    it('points at Google OAuth2 endpoint', async () => {
      const { youtubeProvider } = await import('@/lib/oauth/youtube');
      const url = youtubeProvider.authorizationUrl({ state: 's1', redirectUri: 'https://app.example.com/cb' });
      expect(new URL(url).hostname).toBe('accounts.google.com');
    });

    it('includes the state param', async () => {
      const { youtubeProvider } = await import('@/lib/oauth/youtube');
      const url = youtubeProvider.authorizationUrl({ state: 'my-state', redirectUri: 'https://r.example.com/cb' });
      expect(new URL(url).searchParams.get('state')).toBe('my-state');
    });

    it('includes the redirect_uri param', async () => {
      const { youtubeProvider } = await import('@/lib/oauth/youtube');
      const redirectUri = 'https://app.example.com/oauth/youtube/callback';
      const url = youtubeProvider.authorizationUrl({ state: 's', redirectUri });
      expect(new URL(url).searchParams.get('redirect_uri')).toBe(redirectUri);
    });

    it('includes the client_id from env', async () => {
      const { youtubeProvider } = await import('@/lib/oauth/youtube');
      const url = youtubeProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.example.com/cb' });
      expect(new URL(url).searchParams.get('client_id')).toBe('yt-client-id');
    });

    it('includes response_type=code', async () => {
      const { youtubeProvider } = await import('@/lib/oauth/youtube');
      const url = youtubeProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.example.com/cb' });
      expect(new URL(url).searchParams.get('response_type')).toBe('code');
    });

    it('includes access_type=offline', async () => {
      const { youtubeProvider } = await import('@/lib/oauth/youtube');
      const url = youtubeProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.example.com/cb' });
      expect(new URL(url).searchParams.get('access_type')).toBe('offline');
    });

    it('includes prompt=consent', async () => {
      const { youtubeProvider } = await import('@/lib/oauth/youtube');
      const url = youtubeProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.example.com/cb' });
      expect(new URL(url).searchParams.get('prompt')).toBe('consent');
    });

    it('throws when YOUTUBE_OAUTH_CLIENT_ID is not set', async () => {
      vi.unstubAllEnvs();
      const { youtubeProvider } = await import('@/lib/oauth/youtube');
      expect(() => youtubeProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.example.com/cb' }))
        .toThrow('YOUTUBE_OAUTH_CLIENT_ID');
    });
  });

  describe('exchangeCode()', () => {
    it('returns the correct shape on success', async () => {
      const channelBody = { items: [{ id: 'UC123', snippet: { title: 'My Channel' } }] };
      vi.stubGlobal('fetch', makeFetchMock([
        { ok: true, body: { access_token: 'at', refresh_token: 'rt', expires_in: 3600, scope: 'yt-scope' } },
        { ok: true, body: channelBody },
      ]));
      const { youtubeProvider } = await import('@/lib/oauth/youtube');
      const result = await youtubeProvider.exchangeCode({ code: 'code1', redirectUri: 'https://r.example.com/cb' });
      expect(result.accessToken).toBe('at');
      expect(result.refreshToken).toBe('rt');
      expect(result.externalAccountId).toBe('UC123');
      expect(result.externalAccountLabel).toBe('My Channel');
      expect(result.scope).toBe('yt-scope');
      expect(result.expiresAt).toBeTruthy();
    });

    it('uses channel.id as label when snippet.title is missing', async () => {
      const channelBody = { items: [{ id: 'UC456', snippet: {} }] };
      vi.stubGlobal('fetch', makeFetchMock([
        { ok: true, body: { access_token: 'at', refresh_token: 'rt', expires_in: 3600 } },
        { ok: true, body: channelBody },
      ]));
      const { youtubeProvider } = await import('@/lib/oauth/youtube');
      const result = await youtubeProvider.exchangeCode({ code: 'c', redirectUri: 'https://r.example.com/cb' });
      expect(result.externalAccountLabel).toBe('UC456');
    });

    it('returns null channel info when channel fetch returns empty items', async () => {
      vi.stubGlobal('fetch', makeFetchMock([
        { ok: true, body: { access_token: 'at', refresh_token: 'rt', expires_in: 3600 } },
        { ok: true, body: { items: [] } },
      ]));
      const { youtubeProvider } = await import('@/lib/oauth/youtube');
      const result = await youtubeProvider.exchangeCode({ code: 'c', redirectUri: 'https://r.example.com/cb' });
      expect(result.externalAccountId).toBeNull();
      expect(result.externalAccountLabel).toBeNull();
    });

    it('returns null channel info when channel fetch fails (non-ok)', async () => {
      vi.stubGlobal('fetch', makeFetchMock([
        { ok: true, body: { access_token: 'at', refresh_token: 'rt', expires_in: 3600 } },
        { ok: false, status: 403, body: {} },
      ]));
      const { youtubeProvider } = await import('@/lib/oauth/youtube');
      const result = await youtubeProvider.exchangeCode({ code: 'c', redirectUri: 'https://r.example.com/cb' });
      expect(result.externalAccountId).toBeNull();
    });

    it('throws when token exchange HTTP response is not ok', async () => {
      vi.stubGlobal('fetch', makeFetchMock([
        { ok: false, status: 400, text: 'invalid_grant' },
      ]));
      const { youtubeProvider } = await import('@/lib/oauth/youtube');
      await expect(youtubeProvider.exchangeCode({ code: 'bad', redirectUri: 'https://r.example.com/cb' }))
        .rejects.toThrow('YouTube token exchange failed');
    });

    it('throws when Google does not return a refresh_token', async () => {
      vi.stubGlobal('fetch', makeFetchMock([
        { ok: true, body: { access_token: 'at', expires_in: 3600 } },
      ]));
      const { youtubeProvider } = await import('@/lib/oauth/youtube');
      await expect(youtubeProvider.exchangeCode({ code: 'c', redirectUri: 'https://r.example.com/cb' }))
        .rejects.toThrow('refresh_token');
    });
  });

  describe('refreshAccessToken()', () => {
    it('returns new accessToken and expiresAt on success', async () => {
      vi.stubGlobal('fetch', makeFetchMock([
        { ok: true, body: { access_token: 'new-at', expires_in: 3600 } },
      ]));
      const { youtubeProvider } = await import('@/lib/oauth/youtube');
      const result = await youtubeProvider.refreshAccessToken('old-rt');
      expect(result.accessToken).toBe('new-at');
      expect(result.expiresAt).toBeTruthy();
    });

    it('passes through a new refresh_token when Google rotates it', async () => {
      vi.stubGlobal('fetch', makeFetchMock([
        { ok: true, body: { access_token: 'new-at', expires_in: 3600, refresh_token: 'rotated-rt' } },
      ]));
      const { youtubeProvider } = await import('@/lib/oauth/youtube');
      const result = await youtubeProvider.refreshAccessToken('old-rt');
      expect(result.refreshToken).toBe('rotated-rt');
    });

    it('returns null refreshToken when Google does not rotate it', async () => {
      vi.stubGlobal('fetch', makeFetchMock([
        { ok: true, body: { access_token: 'new-at', expires_in: 3600 } },
      ]));
      const { youtubeProvider } = await import('@/lib/oauth/youtube');
      const result = await youtubeProvider.refreshAccessToken('old-rt');
      expect(result.refreshToken).toBeNull();
    });

    it('throws when HTTP response is not ok', async () => {
      vi.stubGlobal('fetch', makeFetchMock([
        { ok: false, status: 401, text: 'token_expired' },
      ]));
      const { youtubeProvider } = await import('@/lib/oauth/youtube');
      await expect(youtubeProvider.refreshAccessToken('bad-rt'))
        .rejects.toThrow('YouTube token refresh failed');
    });
  });
});

// ── TikTok provider ───────────────────────────────────────────────────────────

describe('tiktokProvider', () => {
  beforeEach(() => {
    vi.stubEnv('TIKTOK_OAUTH_CLIENT_KEY', 'tt-client-key');
    vi.stubEnv('TIKTOK_OAUTH_CLIENT_SECRET', 'tt-client-secret');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('requiresPkce is false', async () => {
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    expect(tiktokProvider.requiresPkce).toBe(false);
  });

  describe('authorizationUrl()', () => {
    it('returns a valid https URL targeting TikTok', async () => {
      const { tiktokProvider } = await import('@/lib/oauth/tiktok');
      const url = tiktokProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.example.com/cb' });
      expect(new URL(url).hostname).toBe('www.tiktok.com');
    });

    it('includes the state param', async () => {
      const { tiktokProvider } = await import('@/lib/oauth/tiktok');
      const url = tiktokProvider.authorizationUrl({ state: 'tt-state', redirectUri: 'https://r.example.com/cb' });
      expect(new URL(url).searchParams.get('state')).toBe('tt-state');
    });

    it('includes client_key from env', async () => {
      const { tiktokProvider } = await import('@/lib/oauth/tiktok');
      const url = tiktokProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.example.com/cb' });
      expect(new URL(url).searchParams.get('client_key')).toBe('tt-client-key');
    });

    it('includes response_type=code', async () => {
      const { tiktokProvider } = await import('@/lib/oauth/tiktok');
      const url = tiktokProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.example.com/cb' });
      expect(new URL(url).searchParams.get('response_type')).toBe('code');
    });

    it('throws when TIKTOK_OAUTH_CLIENT_KEY is not set', async () => {
      vi.unstubAllEnvs();
      const { tiktokProvider } = await import('@/lib/oauth/tiktok');
      expect(() => tiktokProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.example.com/cb' }))
        .toThrow('TIKTOK_OAUTH_CLIENT_KEY');
    });
  });

  describe('exchangeCode()', () => {
    it('returns the correct shape on success', async () => {
      vi.stubGlobal('fetch', makeFetchMock([
        { ok: true, body: { access_token: 'tt-at', refresh_token: 'tt-rt', expires_in: 86400, open_id: 'uid1', scope: 'video.publish' } },
        { ok: true, body: { data: { user: { display_name: 'TikTokUser' } } } },
      ]));
      const { tiktokProvider } = await import('@/lib/oauth/tiktok');
      const result = await tiktokProvider.exchangeCode({ code: 'code1', redirectUri: 'https://r.example.com/cb' });
      expect(result.accessToken).toBe('tt-at');
      expect(result.refreshToken).toBe('tt-rt');
      expect(result.externalAccountId).toBe('uid1');
      expect(result.externalAccountLabel).toBe('TikTokUser');
      expect(result.expiresAt).toBeTruthy();
    });

    it('handles missing expires_in (expiresAt is null)', async () => {
      vi.stubGlobal('fetch', makeFetchMock([
        { ok: true, body: { access_token: 'at', refresh_token: 'rt', open_id: 'uid' } },
        { ok: false, body: {} },
      ]));
      const { tiktokProvider } = await import('@/lib/oauth/tiktok');
      const result = await tiktokProvider.exchangeCode({ code: 'c', redirectUri: 'https://r.example.com/cb' });
      expect(result.expiresAt).toBeNull();
    });

    it('returns null display name when user info fetch fails', async () => {
      vi.stubGlobal('fetch', makeFetchMock([
        { ok: true, body: { access_token: 'at', refresh_token: 'rt', open_id: 'uid', expires_in: 3600 } },
        { ok: false, status: 401, body: {} },
      ]));
      const { tiktokProvider } = await import('@/lib/oauth/tiktok');
      const result = await tiktokProvider.exchangeCode({ code: 'c', redirectUri: 'https://r.example.com/cb' });
      expect(result.externalAccountLabel).toBeNull();
    });

    it('throws when body contains error field', async () => {
      vi.stubGlobal('fetch', makeFetchMock([
        { ok: true, body: { error: 'invalid_grant', message: 'bad code' } },
      ]));
      const { tiktokProvider } = await import('@/lib/oauth/tiktok');
      await expect(tiktokProvider.exchangeCode({ code: 'bad', redirectUri: 'https://r.example.com/cb' }))
        .rejects.toThrow('TikTok token exchange failed');
    });

    it('throws when HTTP response is not ok', async () => {
      vi.stubGlobal('fetch', makeFetchMock([
        { ok: false, status: 400, body: { error: 'bad_request' } },
      ]));
      const { tiktokProvider } = await import('@/lib/oauth/tiktok');
      await expect(tiktokProvider.exchangeCode({ code: 'bad', redirectUri: 'https://r.example.com/cb' }))
        .rejects.toThrow('TikTok token exchange failed');
    });
  });

  describe('refreshAccessToken()', () => {
    it('returns new accessToken on success', async () => {
      vi.stubGlobal('fetch', makeFetchMock([
        { ok: true, body: { access_token: 'new-tt-at', expires_in: 86400 } },
      ]));
      const { tiktokProvider } = await import('@/lib/oauth/tiktok');
      const result = await tiktokProvider.refreshAccessToken('old-rt');
      expect(result.accessToken).toBe('new-tt-at');
    });

    it('handles missing expires_in (expiresAt is null)', async () => {
      vi.stubGlobal('fetch', makeFetchMock([
        { ok: true, body: { access_token: 'new-at' } },
      ]));
      const { tiktokProvider } = await import('@/lib/oauth/tiktok');
      const result = await tiktokProvider.refreshAccessToken('old-rt');
      expect(result.expiresAt).toBeNull();
    });

    it('returns new refreshToken when rotated', async () => {
      vi.stubGlobal('fetch', makeFetchMock([
        { ok: true, body: { access_token: 'new-at', expires_in: 3600, refresh_token: 'new-rt' } },
      ]));
      const { tiktokProvider } = await import('@/lib/oauth/tiktok');
      const result = await tiktokProvider.refreshAccessToken('old-rt');
      expect(result.refreshToken).toBe('new-rt');
    });

    it('throws when HTTP response is not ok', async () => {
      vi.stubGlobal('fetch', makeFetchMock([
        { ok: false, status: 401, body: { error: 'token_expired' } },
      ]));
      const { tiktokProvider } = await import('@/lib/oauth/tiktok');
      await expect(tiktokProvider.refreshAccessToken('bad-rt'))
        .rejects.toThrow('TikTok token refresh failed');
    });

    it('throws when body contains error field on refresh', async () => {
      vi.stubGlobal('fetch', makeFetchMock([
        { ok: true, body: { error: 'refresh_token_expired' } },
      ]));
      const { tiktokProvider } = await import('@/lib/oauth/tiktok');
      await expect(tiktokProvider.refreshAccessToken('bad-rt'))
        .rejects.toThrow('TikTok token refresh failed');
    });
  });
});

// ── Facebook provider ─────────────────────────────────────────────────────────

describe('facebookProvider', () => {
  beforeEach(() => {
    vi.stubEnv('FACEBOOK_APP_ID', 'fb-app-id');
    vi.stubEnv('FACEBOOK_APP_SECRET', 'fb-app-secret');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('requiresPkce is false', async () => {
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    expect(facebookProvider.requiresPkce).toBe(false);
  });

  describe('authorizationUrl()', () => {
    it('returns a valid https URL targeting Facebook', async () => {
      const { facebookProvider } = await import('@/lib/oauth/facebook');
      const url = facebookProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.example.com/cb' });
      const parsed = new URL(url);
      expect(parsed.hostname).toBe('www.facebook.com');
    });

    it('includes the state param', async () => {
      const { facebookProvider } = await import('@/lib/oauth/facebook');
      const url = facebookProvider.authorizationUrl({ state: 'fb-state', redirectUri: 'https://r.example.com/cb' });
      expect(new URL(url).searchParams.get('state')).toBe('fb-state');
    });

    it('includes client_id from env', async () => {
      const { facebookProvider } = await import('@/lib/oauth/facebook');
      const url = facebookProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.example.com/cb' });
      expect(new URL(url).searchParams.get('client_id')).toBe('fb-app-id');
    });

    it('includes response_type=code', async () => {
      const { facebookProvider } = await import('@/lib/oauth/facebook');
      const url = facebookProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.example.com/cb' });
      expect(new URL(url).searchParams.get('response_type')).toBe('code');
    });

    it('throws when FACEBOOK_APP_ID is not set', async () => {
      vi.unstubAllEnvs();
      const { facebookProvider } = await import('@/lib/oauth/facebook');
      expect(() => facebookProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.example.com/cb' }))
        .toThrow('FACEBOOK_APP_ID');
    });
  });

  describe('exchangeCode()', () => {
    const pageData = { data: [{ id: 'page1', name: 'My Page', access_token: 'page-at' }] };

    it('returns the correct shape on success', async () => {
      vi.stubGlobal('fetch', makeFetchMock([
        { ok: true, body: { access_token: 'short-lived' } },
        { ok: true, body: { access_token: 'long-lived' } },
        { ok: true, body: pageData },
      ]));
      const { facebookProvider } = await import('@/lib/oauth/facebook');
      const result = await facebookProvider.exchangeCode({ code: 'code1', redirectUri: 'https://r.example.com/cb' });
      expect(result.accessToken).toBe('page-at');
      expect(result.refreshToken).toBe('long-lived');
      expect(result.externalAccountId).toBe('page1');
      expect(result.externalAccountLabel).toBe('My Page');
      expect(result.expiresAt).toBeNull();
    });

    it('uses page.id as label when page.name is missing', async () => {
      const pageNoName = { data: [{ id: 'page2', access_token: 'page-at2' }] };
      vi.stubGlobal('fetch', makeFetchMock([
        { ok: true, body: { access_token: 'short' } },
        { ok: true, body: { access_token: 'long' } },
        { ok: true, body: pageNoName },
      ]));
      const { facebookProvider } = await import('@/lib/oauth/facebook');
      const result = await facebookProvider.exchangeCode({ code: 'c', redirectUri: 'https://r.example.com/cb' });
      expect(result.externalAccountLabel).toBe('page2');
    });

    it('throws when short-lived token exchange returns no access_token', async () => {
      vi.stubGlobal('fetch', makeFetchMock([
        { ok: true, body: {} },
      ]));
      const { facebookProvider } = await import('@/lib/oauth/facebook');
      await expect(facebookProvider.exchangeCode({ code: 'bad', redirectUri: 'https://r.example.com/cb' }))
        .rejects.toThrow('Facebook code exchange returned no access_token');
    });

    it('throws when long-lived token exchange returns no access_token', async () => {
      vi.stubGlobal('fetch', makeFetchMock([
        { ok: true, body: { access_token: 'short' } },
        { ok: true, body: {} },
      ]));
      const { facebookProvider } = await import('@/lib/oauth/facebook');
      await expect(facebookProvider.exchangeCode({ code: 'c', redirectUri: 'https://r.example.com/cb' }))
        .rejects.toThrow('Facebook long-lived token exchange failed');
    });

    it('throws when account has no pages', async () => {
      vi.stubGlobal('fetch', makeFetchMock([
        { ok: true, body: { access_token: 'short' } },
        { ok: true, body: { access_token: 'long' } },
        { ok: true, body: { data: [] } },
      ]));
      const { facebookProvider } = await import('@/lib/oauth/facebook');
      await expect(facebookProvider.exchangeCode({ code: 'c', redirectUri: 'https://r.example.com/cb' }))
        .rejects.toThrow('no Pages');
    });

    it('throws when Graph API call fails (error in body)', async () => {
      vi.stubGlobal('fetch', makeFetchMock([
        { ok: true, body: { error: { message: 'Invalid code' } } },
      ]));
      const { facebookProvider } = await import('@/lib/oauth/facebook');
      await expect(facebookProvider.exchangeCode({ code: 'bad', redirectUri: 'https://r.example.com/cb' }))
        .rejects.toThrow('Facebook Graph API call failed');
    });
  });

  describe('refreshAccessToken()', () => {
    it('returns new page accessToken on success', async () => {
      const pageData = { data: [{ id: 'page1', name: 'My Page', access_token: 'new-page-at' }] };
      vi.stubGlobal('fetch', makeFetchMock([
        { ok: true, body: pageData },
      ]));
      const { facebookProvider } = await import('@/lib/oauth/facebook');
      const result = await facebookProvider.refreshAccessToken('long-lived-user-token');
      expect(result.accessToken).toBe('new-page-at');
      expect(result.expiresAt).toBeNull();
      expect(result.refreshToken).toBeNull();
    });

    it('throws when the long-lived user token is no longer valid', async () => {
      vi.stubGlobal('fetch', makeFetchMock([
        { ok: true, body: { data: [] } },
      ]));
      const { facebookProvider } = await import('@/lib/oauth/facebook');
      await expect(facebookProvider.refreshAccessToken('expired-token'))
        .rejects.toThrow('re-derivation failed');
    });
  });
});

// ── Canva provider ────────────────────────────────────────────────────────────

describe('canvaProvider', () => {
  beforeEach(() => {
    vi.stubEnv('CANVA_CLIENT_ID', 'canva-client-id');
    vi.stubEnv('CANVA_CLIENT_SECRET', 'canva-client-secret');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('requiresPkce is true', async () => {
    const { canvaProvider } = await import('@/lib/oauth/canva');
    expect(canvaProvider.requiresPkce).toBe(true);
  });

  describe('authorizationUrl()', () => {
    it('returns a valid https URL targeting Canva', async () => {
      const { canvaProvider } = await import('@/lib/oauth/canva');
      const url = canvaProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.example.com/cb', codeChallenge: 'challenge1' });
      expect(new URL(url).hostname).toBe('www.canva.com');
    });

    it('includes the state param', async () => {
      const { canvaProvider } = await import('@/lib/oauth/canva');
      const url = canvaProvider.authorizationUrl({ state: 'canva-state', redirectUri: 'https://r.example.com/cb', codeChallenge: 'ch' });
      expect(new URL(url).searchParams.get('state')).toBe('canva-state');
    });

    it('includes code_challenge and code_challenge_method=S256', async () => {
      const { canvaProvider } = await import('@/lib/oauth/canva');
      const url = canvaProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.example.com/cb', codeChallenge: 'mychallenge' });
      expect(new URL(url).searchParams.get('code_challenge')).toBe('mychallenge');
      expect(new URL(url).searchParams.get('code_challenge_method')).toBe('S256');
    });

    it('uses empty string when codeChallenge is omitted', async () => {
      const { canvaProvider } = await import('@/lib/oauth/canva');
      const url = canvaProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.example.com/cb' });
      expect(new URL(url).searchParams.get('code_challenge')).toBe('');
    });

    it('includes client_id from env', async () => {
      const { canvaProvider } = await import('@/lib/oauth/canva');
      const url = canvaProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.example.com/cb', codeChallenge: 'ch' });
      expect(new URL(url).searchParams.get('client_id')).toBe('canva-client-id');
    });

    it('throws when CANVA_CLIENT_ID is not set', async () => {
      vi.unstubAllEnvs();
      const { canvaProvider } = await import('@/lib/oauth/canva');
      expect(() => canvaProvider.authorizationUrl({ state: 's', redirectUri: 'https://r.example.com/cb', codeChallenge: 'ch' }))
        .toThrow('CANVA_CLIENT_ID');
    });
  });

  describe('exchangeCode()', () => {
    it('returns the correct shape on success', async () => {
      vi.stubGlobal('fetch', makeFetchMock([
        { ok: true, body: { access_token: 'cv-at', refresh_token: 'cv-rt', expires_in: 3600, scope: 'design:content:write' } },
        { ok: true, body: { display_name: 'Canva User' } },
      ]));
      const { canvaProvider } = await import('@/lib/oauth/canva');
      const result = await canvaProvider.exchangeCode({ code: 'code1', redirectUri: 'https://r.example.com/cb', codeVerifier: 'verifier1' });
      expect(result.accessToken).toBe('cv-at');
      expect(result.refreshToken).toBe('cv-rt');
      expect(result.externalAccountLabel).toBe('Canva User');
      expect(result.externalAccountId).toBeNull();
      expect(result.expiresAt).toBeTruthy();
    });

    it('returns null label when profile fetch fails', async () => {
      vi.stubGlobal('fetch', makeFetchMock([
        { ok: true, body: { access_token: 'cv-at', refresh_token: 'cv-rt', expires_in: 3600 } },
        { ok: false, status: 403, body: {} },
      ]));
      const { canvaProvider } = await import('@/lib/oauth/canva');
      const result = await canvaProvider.exchangeCode({ code: 'c', redirectUri: 'https://r.example.com/cb', codeVerifier: 'v' });
      expect(result.externalAccountLabel).toBeNull();
    });

    it('handles missing codeVerifier (uses empty string)', async () => {
      vi.stubGlobal('fetch', makeFetchMock([
        { ok: true, body: { access_token: 'cv-at', refresh_token: 'cv-rt', expires_in: 3600 } },
        { ok: true, body: { display_name: null } },
      ]));
      const { canvaProvider } = await import('@/lib/oauth/canva');
      const result = await canvaProvider.exchangeCode({ code: 'c', redirectUri: 'https://r.example.com/cb' });
      expect(result.accessToken).toBe('cv-at');
    });

    it('throws when token exchange HTTP response is not ok', async () => {
      vi.stubGlobal('fetch', makeFetchMock([
        { ok: false, status: 400, text: 'invalid_grant' },
      ]));
      const { canvaProvider } = await import('@/lib/oauth/canva');
      await expect(canvaProvider.exchangeCode({ code: 'bad', redirectUri: 'https://r.example.com/cb', codeVerifier: 'v' }))
        .rejects.toThrow('Canva token exchange failed');
    });

    it('sends Authorization header with Basic auth (base64 of client_id:secret)', async () => {
      const captured: Request[] = [];
      vi.stubGlobal('fetch', vi.fn().mockImplementation(async (url: string, init: RequestInit) => {
        captured.push({ url, ...init } as unknown as Request);
        return { ok: true, json: async () => ({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 }), text: async () => '' };
      }));
      const { canvaProvider } = await import('@/lib/oauth/canva');
      await canvaProvider.exchangeCode({ code: 'c', redirectUri: 'https://r.example.com/cb', codeVerifier: 'v' });
      const expected = `Basic ${Buffer.from('canva-client-id:canva-client-secret').toString('base64')}`;
      expect((captured[0] as unknown as { headers: Record<string, string> }).headers['Authorization']).toBe(expected);
    });
  });

  describe('refreshAccessToken()', () => {
    it('returns new accessToken and expiresAt on success', async () => {
      vi.stubGlobal('fetch', makeFetchMock([
        { ok: true, body: { access_token: 'new-cv-at', expires_in: 3600 } },
      ]));
      const { canvaProvider } = await import('@/lib/oauth/canva');
      const result = await canvaProvider.refreshAccessToken('old-rt');
      expect(result.accessToken).toBe('new-cv-at');
      expect(result.expiresAt).toBeTruthy();
    });

    it('returns new refreshToken when rotated', async () => {
      vi.stubGlobal('fetch', makeFetchMock([
        { ok: true, body: { access_token: 'new-at', expires_in: 3600, refresh_token: 'new-rt' } },
      ]));
      const { canvaProvider } = await import('@/lib/oauth/canva');
      const result = await canvaProvider.refreshAccessToken('old-rt');
      expect(result.refreshToken).toBe('new-rt');
    });

    it('returns null refreshToken when not rotated', async () => {
      vi.stubGlobal('fetch', makeFetchMock([
        { ok: true, body: { access_token: 'new-at', expires_in: 3600 } },
      ]));
      const { canvaProvider } = await import('@/lib/oauth/canva');
      const result = await canvaProvider.refreshAccessToken('old-rt');
      expect(result.refreshToken).toBeNull();
    });

    it('throws when HTTP response is not ok', async () => {
      vi.stubGlobal('fetch', makeFetchMock([
        { ok: false, status: 401, text: 'token_expired' },
      ]));
      const { canvaProvider } = await import('@/lib/oauth/canva');
      await expect(canvaProvider.refreshAccessToken('bad-rt'))
        .rejects.toThrow('Canva token refresh failed');
    });
  });
});
