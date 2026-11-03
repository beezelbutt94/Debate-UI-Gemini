/**
 * Tests for functions that call fetch() or external SDKs.
 * All network I/O is intercepted via vitest's global fetch mock.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── helpers ──────────────────────────────────────────────────────────────────

function mockFetch(...responses: Array<{ ok: boolean; status?: number; json?: () => unknown; text?: () => string; headers?: Record<string, string> }>) {
  let call = 0;
  const mock = vi.fn(async () => {
    const spec = responses[Math.min(call++, responses.length - 1)];
    return {
      ok: spec.ok,
      status: spec.status ?? (spec.ok ? 200 : 400),
      json: spec.json ? spec.json : async () => ({}),
      text: spec.text ? async () => spec.text!() : async () => '',
      body: null,
      headers: {
        get: (h: string) => (spec.headers ?? {})[h] ?? null,
      },
    };
  });
  vi.stubGlobal('fetch', mock);
  return mock;
}

// ─── platform-api ─────────────────────────────────────────────────────────────

// platform-api.ts memoizes the probe with a module-level variable, so we
// isolate each test with vi.resetModules() to get a fresh import.

describe('platformApiFetch()', () => {
  beforeEach(() => {
    vi.resetModules();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns { state: "unavailable" } when platform-status says not configured', async () => {
    mockFetch({ ok: true, json: () => ({ configured: false }) });
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/something');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns { state: "unavailable" } when platform-status probe fails', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network error'));
    vi.stubGlobal('fetch', fetchMock);
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/something');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns { state: "ok", data } on a successful 200 response', async () => {
    mockFetch(
      { ok: true, json: () => ({ configured: true }) },  // probe
      { ok: true, json: () => ({ id: 'abc', name: 'Test' }) }  // actual request
    );
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch<{ id: string; name: string }>('/api/v1/resource');
    expect(result).toEqual({ state: 'ok', data: { id: 'abc', name: 'Test' } });
  });

  it('returns { state: "not_found" } on a 404 response', async () => {
    mockFetch(
      { ok: true, json: () => ({ configured: true }) },
      { ok: false, status: 404, json: () => ({}) }
    );
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/missing');
    expect(result).toEqual({ state: 'not_found' });
  });

  it('returns { state: "error" } with message from body.detail on non-404 failure', async () => {
    mockFetch(
      { ok: true, json: () => ({ configured: true }) },
      { ok: false, status: 500, json: () => ({ detail: 'Internal error' }) }
    );
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/broken');
    expect(result).toMatchObject({ state: 'error', message: 'Internal error' });
  });

  it('returns { state: "error" } with fallback message when body has no detail', async () => {
    mockFetch(
      { ok: true, json: () => ({ configured: true }) },
      { ok: false, status: 503, json: () => ({}) }
    );
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/broken');
    expect(result).toMatchObject({ state: 'error', message: 'Request failed (503)' });
  });

  it('returns { state: "unreachable" } when fetch throws after probe succeeds', async () => {
    let call = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      if (call++ === 0) {
        return { ok: true, json: async () => ({ configured: true }), headers: { get: () => null } };
      }
      throw new Error('ECONNREFUSED');
    }));
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/resource');
    expect(result).toMatchObject({ state: 'unreachable', message: 'ECONNREFUSED' });
  });
});

// ─── OAuth providers: exchangeCode ────────────────────────────────────────────

describe('youtubeProvider.exchangeCode()', () => {
  beforeEach(() => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'yt-id';
    process.env.YOUTUBE_OAUTH_CLIENT_SECRET = 'yt-secret';
  });
  afterEach(() => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    delete process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
    vi.restoreAllMocks();
  });

  it('returns a TokenExchangeResult with refresh token', async () => {
    mockFetch(
      // Token endpoint
      {
        ok: true,
        json: () => ({
          access_token: 'yt-access',
          refresh_token: 'yt-refresh',
          expires_in: 3600,
          scope: 'https://www.googleapis.com/auth/youtube.upload',
        }),
      },
      // Channel list
      {
        ok: true,
        json: () => ({ items: [{ id: 'UCchan1', snippet: { title: 'My Channel' } }] }),
      }
    );

    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const result = await youtubeProvider.exchangeCode({ code: 'auth-code', redirectUri: 'https://app.example.com/cb' });

    expect(result.accessToken).toBe('yt-access');
    expect(result.refreshToken).toBe('yt-refresh');
    expect(result.externalAccountId).toBe('UCchan1');
    expect(result.externalAccountLabel).toBe('My Channel');
    expect(result.expiresAt).toBeTruthy();
  });

  it('throws when the token response has no refresh_token', async () => {
    mockFetch({
      ok: true,
      json: () => ({ access_token: 'yt-access', expires_in: 3600, scope: 'upload' }),
    });

    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    await expect(youtubeProvider.exchangeCode({ code: 'code', redirectUri: 'https://app.example.com/cb' }))
      .rejects.toThrow('refresh_token');
  });

  it('throws when the token endpoint returns non-OK', async () => {
    mockFetch({ ok: false, status: 401, text: () => 'Unauthorized' });

    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    await expect(youtubeProvider.exchangeCode({ code: 'code', redirectUri: 'https://app.example.com/cb' }))
      .rejects.toThrow('YouTube token exchange failed');
  });

  it('works even when the channel fetch fails (sets ids to null)', async () => {
    mockFetch(
      {
        ok: true,
        json: () => ({ access_token: 'yt-access', refresh_token: 'yt-refresh', expires_in: 3600, scope: 'upload' }),
      },
      { ok: false, status: 403, text: () => 'Forbidden', json: () => ({}) }
    );

    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const result = await youtubeProvider.exchangeCode({ code: 'code', redirectUri: 'https://app.example.com/cb' });

    expect(result.externalAccountId).toBeNull();
    expect(result.externalAccountLabel).toBeNull();
  });
});

describe('youtubeProvider.refreshAccessToken()', () => {
  beforeEach(() => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'yt-id';
    process.env.YOUTUBE_OAUTH_CLIENT_SECRET = 'yt-secret';
  });
  afterEach(() => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    delete process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
    vi.restoreAllMocks();
  });

  it('returns refreshed tokens', async () => {
    mockFetch({
      ok: true,
      json: () => ({ access_token: 'new-yt-access', expires_in: 3600 }),
    });

    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const result = await youtubeProvider.refreshAccessToken('old-refresh');

    expect(result.accessToken).toBe('new-yt-access');
    expect(result.refreshToken).toBeNull();
    expect(result.expiresAt).toBeTruthy();
  });

  it('propagates a rotated refresh token when Google issues one', async () => {
    mockFetch({
      ok: true,
      json: () => ({ access_token: 'new-yt-access', refresh_token: 'new-yt-refresh', expires_in: 3600 }),
    });

    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const result = await youtubeProvider.refreshAccessToken('old-refresh');
    expect(result.refreshToken).toBe('new-yt-refresh');
  });

  it('throws when the refresh endpoint returns non-OK', async () => {
    mockFetch({ ok: false, status: 400, text: () => 'invalid_grant' });

    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    await expect(youtubeProvider.refreshAccessToken('bad-token')).rejects.toThrow('YouTube token refresh failed');
  });
});

// ─── TikTok OAuth ─────────────────────────────────────────────────────────────

describe('tiktokProvider.exchangeCode()', () => {
  beforeEach(() => {
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'tt-key';
    process.env.TIKTOK_OAUTH_CLIENT_SECRET = 'tt-secret';
  });
  afterEach(() => {
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    delete process.env.TIKTOK_OAUTH_CLIENT_SECRET;
    vi.restoreAllMocks();
  });

  it('returns a TokenExchangeResult', async () => {
    mockFetch(
      {
        ok: true,
        json: () => ({
          access_token: 'tt-access',
          refresh_token: 'tt-refresh',
          expires_in: 86400,
          open_id: 'tt-open-id',
          scope: 'video.publish',
        }),
      },
      {
        ok: true,
        json: () => ({ data: { user: { display_name: 'TikTokUser' } } }),
      }
    );

    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const result = await tiktokProvider.exchangeCode({ code: 'tt-code', redirectUri: 'https://app.example.com/cb' });

    expect(result.accessToken).toBe('tt-access');
    expect(result.refreshToken).toBe('tt-refresh');
    expect(result.externalAccountId).toBe('tt-open-id');
    expect(result.externalAccountLabel).toBe('TikTokUser');
  });

  it('handles missing expires_in (sets expiresAt to null)', async () => {
    mockFetch(
      { ok: true, json: () => ({ access_token: 'tt-access', refresh_token: 'tt-refresh', scope: 'video.publish' }) },
      { ok: false, status: 403, json: () => ({}) }
    );

    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const result = await tiktokProvider.exchangeCode({ code: 'code', redirectUri: 'https://app.example.com/cb' });
    expect(result.expiresAt).toBeNull();
  });

  it('throws when token endpoint returns error field', async () => {
    mockFetch({ ok: true, json: () => ({ error: 'invalid_client', error_description: 'Bad key' }) });

    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    await expect(tiktokProvider.exchangeCode({ code: 'code', redirectUri: 'https://app.example.com/cb' }))
      .rejects.toThrow('TikTok token exchange failed');
  });

  it('throws when token endpoint returns non-OK status', async () => {
    mockFetch({ ok: false, status: 500, json: () => ({}) });

    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    await expect(tiktokProvider.exchangeCode({ code: 'code', redirectUri: 'https://app.example.com/cb' }))
      .rejects.toThrow('TikTok token exchange failed');
  });
});

describe('tiktokProvider.refreshAccessToken()', () => {
  beforeEach(() => {
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'tt-key';
    process.env.TIKTOK_OAUTH_CLIENT_SECRET = 'tt-secret';
  });
  afterEach(() => {
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    delete process.env.TIKTOK_OAUTH_CLIENT_SECRET;
    vi.restoreAllMocks();
  });

  it('returns refreshed tokens', async () => {
    mockFetch({
      ok: true,
      json: () => ({ access_token: 'new-tt-access', refresh_token: 'new-tt-refresh', expires_in: 86400 }),
    });

    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const result = await tiktokProvider.refreshAccessToken('old-refresh');

    expect(result.accessToken).toBe('new-tt-access');
    expect(result.refreshToken).toBe('new-tt-refresh');
  });

  it('throws when refresh fails', async () => {
    mockFetch({ ok: false, status: 401, json: () => ({ error: 'expired_token' }) });

    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    await expect(tiktokProvider.refreshAccessToken('bad-token')).rejects.toThrow('TikTok token refresh failed');
  });
});

// ─── Facebook OAuth ───────────────────────────────────────────────────────────

describe('facebookProvider.exchangeCode()', () => {
  beforeEach(() => {
    process.env.FACEBOOK_APP_ID = 'fb-app-id';
    process.env.FACEBOOK_APP_SECRET = 'fb-secret';
  });
  afterEach(() => {
    delete process.env.FACEBOOK_APP_ID;
    delete process.env.FACEBOOK_APP_SECRET;
    vi.restoreAllMocks();
  });

  it('returns a TokenExchangeResult with page token', async () => {
    mockFetch(
      // short-lived user token
      { ok: true, json: () => ({ access_token: 'short-lived-token' }) },
      // long-lived user token
      { ok: true, json: () => ({ access_token: 'long-lived-token' }) },
      // /me/accounts - pages list
      { ok: true, json: () => ({ data: [{ id: 'page-id', name: 'My Page', access_token: 'page-token' }] }) }
    );

    const { facebookProvider } = await import('@/lib/oauth/facebook');
    const result = await facebookProvider.exchangeCode({ code: 'fb-code', redirectUri: 'https://app.example.com/cb' });

    expect(result.accessToken).toBe('page-token');
    expect(result.refreshToken).toBe('long-lived-token');
    expect(result.externalAccountId).toBe('page-id');
    expect(result.externalAccountLabel).toBe('My Page');
    expect(result.expiresAt).toBeNull();
  });

  it('throws when no access_token in short-lived response', async () => {
    mockFetch({ ok: true, json: () => ({}) });

    const { facebookProvider } = await import('@/lib/oauth/facebook');
    await expect(facebookProvider.exchangeCode({ code: 'code', redirectUri: 'https://app.example.com/cb' }))
      .rejects.toThrow('no access_token');
  });

  it('throws when the user has no managed pages', async () => {
    mockFetch(
      { ok: true, json: () => ({ access_token: 'short' }) },
      { ok: true, json: () => ({ access_token: 'long' }) },
      { ok: true, json: () => ({ data: [] }) }
    );

    const { facebookProvider } = await import('@/lib/oauth/facebook');
    await expect(facebookProvider.exchangeCode({ code: 'code', redirectUri: 'https://app.example.com/cb' }))
      .rejects.toThrow('no Pages');
  });
});

describe('facebookProvider.refreshAccessToken()', () => {
  beforeEach(() => {
    process.env.FACEBOOK_APP_ID = 'fb-app-id';
    process.env.FACEBOOK_APP_SECRET = 'fb-secret';
  });
  afterEach(() => {
    delete process.env.FACEBOOK_APP_ID;
    delete process.env.FACEBOOK_APP_SECRET;
    vi.restoreAllMocks();
  });

  it('re-derives page token from stored long-lived user token', async () => {
    mockFetch({
      ok: true,
      json: () => ({ data: [{ id: 'page-id', name: 'My Page', access_token: 'new-page-token' }] }),
    });

    const { facebookProvider } = await import('@/lib/oauth/facebook');
    const result = await facebookProvider.refreshAccessToken('long-lived-user-token');

    expect(result.accessToken).toBe('new-page-token');
    expect(result.refreshToken).toBeNull();
    expect(result.expiresAt).toBeNull();
  });

  it('throws when the stored long-lived token is no longer valid (no page)', async () => {
    mockFetch({ ok: true, json: () => ({ data: [] }) });

    const { facebookProvider } = await import('@/lib/oauth/facebook');
    await expect(facebookProvider.refreshAccessToken('expired-token'))
      .rejects.toThrow('no longer valid');
  });
});

// ─── Canva OAuth ──────────────────────────────────────────────────────────────

describe('canvaProvider.exchangeCode()', () => {
  beforeEach(() => {
    process.env.CANVA_CLIENT_ID = 'canva-id';
    process.env.CANVA_CLIENT_SECRET = 'canva-secret';
  });
  afterEach(() => {
    delete process.env.CANVA_CLIENT_ID;
    delete process.env.CANVA_CLIENT_SECRET;
    vi.restoreAllMocks();
  });

  it('returns a TokenExchangeResult with display name', async () => {
    mockFetch(
      {
        ok: true,
        json: () => ({
          access_token: 'canva-access',
          refresh_token: 'canva-refresh',
          expires_in: 3600,
          scope: 'design:content:write design:meta:read profile:read',
        }),
      },
      {
        ok: true,
        json: () => ({ display_name: 'Jane Doe' }),
      }
    );

    const { canvaProvider } = await import('@/lib/oauth/canva');
    const result = await canvaProvider.exchangeCode({ code: 'canva-code', redirectUri: 'https://app.example.com/cb', codeVerifier: 'verifier' });

    expect(result.accessToken).toBe('canva-access');
    expect(result.refreshToken).toBe('canva-refresh');
    expect(result.externalAccountLabel).toBe('Jane Doe');
    expect(result.externalAccountId).toBeNull();
    expect(result.expiresAt).toBeTruthy();
  });

  it('throws when token endpoint returns non-OK', async () => {
    mockFetch({ ok: false, status: 401, text: () => 'Unauthorized' });

    const { canvaProvider } = await import('@/lib/oauth/canva');
    await expect(canvaProvider.exchangeCode({ code: 'code', redirectUri: 'https://app.example.com/cb' }))
      .rejects.toThrow('Canva token exchange failed');
  });

  it('handles display name fetch failure gracefully (null label)', async () => {
    mockFetch(
      {
        ok: true,
        json: () => ({ access_token: 'canva-access', refresh_token: 'canva-refresh', expires_in: 3600, scope: 'profile:read' }),
      },
      { ok: false, status: 403, json: () => ({}) }
    );

    const { canvaProvider } = await import('@/lib/oauth/canva');
    const result = await canvaProvider.exchangeCode({ code: 'code', redirectUri: 'https://app.example.com/cb' });
    expect(result.externalAccountLabel).toBeNull();
  });
});

describe('canvaProvider.refreshAccessToken()', () => {
  beforeEach(() => {
    process.env.CANVA_CLIENT_ID = 'canva-id';
    process.env.CANVA_CLIENT_SECRET = 'canva-secret';
  });
  afterEach(() => {
    delete process.env.CANVA_CLIENT_ID;
    delete process.env.CANVA_CLIENT_SECRET;
    vi.restoreAllMocks();
  });

  it('returns refreshed token', async () => {
    mockFetch({
      ok: true,
      json: () => ({ access_token: 'new-canva-access', refresh_token: 'new-canva-refresh', expires_in: 3600 }),
    });

    const { canvaProvider } = await import('@/lib/oauth/canva');
    const result = await canvaProvider.refreshAccessToken('old-refresh');

    expect(result.accessToken).toBe('new-canva-access');
    expect(result.refreshToken).toBe('new-canva-refresh');
    expect(result.expiresAt).toBeTruthy();
  });

  it('throws when refresh endpoint returns non-OK', async () => {
    mockFetch({ ok: false, status: 400, text: () => 'invalid_grant' });

    const { canvaProvider } = await import('@/lib/oauth/canva');
    await expect(canvaProvider.refreshAccessToken('bad-token')).rejects.toThrow('Canva token refresh failed');
  });
});
