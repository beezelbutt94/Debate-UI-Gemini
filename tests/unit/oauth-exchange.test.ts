/**
 * Tests for the exchangeCode and refreshAccessToken methods on each OAuth
 * provider. All external HTTP calls are stubbed via vi.stubGlobal('fetch').
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeResponse(ok: boolean, status: number, body: unknown): Response {
  return {
    ok,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

// ─── setup env vars ───────────────────────────────────────────────────────────

const REDIRECT = 'https://app.example.com/api/oauth/callback/youtube';

function setEnv() {
  process.env.YOUTUBE_OAUTH_CLIENT_ID = 'yt-id';
  process.env.YOUTUBE_OAUTH_CLIENT_SECRET = 'yt-secret';
  process.env.TIKTOK_OAUTH_CLIENT_KEY = 'tt-key';
  process.env.TIKTOK_OAUTH_CLIENT_SECRET = 'tt-secret';
  process.env.FACEBOOK_APP_ID = 'fb-id';
  process.env.FACEBOOK_APP_SECRET = 'fb-secret';
  process.env.CANVA_CLIENT_ID = 'cv-id';
  process.env.CANVA_CLIENT_SECRET = 'cv-secret';
}

function clearEnv() {
  for (const k of [
    'YOUTUBE_OAUTH_CLIENT_ID','YOUTUBE_OAUTH_CLIENT_SECRET',
    'TIKTOK_OAUTH_CLIENT_KEY','TIKTOK_OAUTH_CLIENT_SECRET',
    'FACEBOOK_APP_ID','FACEBOOK_APP_SECRET',
    'CANVA_CLIENT_ID','CANVA_CLIENT_SECRET',
  ]) delete process.env[k];
}

// ─── YouTube exchangeCode ────────────────────────────────────────────────────

describe('youtubeProvider.exchangeCode', () => {
  beforeEach(() => { setEnv(); });
  afterEach(() => { clearEnv(); vi.unstubAllGlobals(); });

  it('returns access/refresh tokens and channel info on success', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth');

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(makeResponse(true, 200, {
        access_token: 'yt-access',
        refresh_token: 'yt-refresh',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/youtube.upload',
      }))
      .mockResolvedValueOnce(makeResponse(true, 200, {
        items: [{ id: 'UCchannel', snippet: { title: 'My Channel' } }],
      }))
    );

    const result = await getOAuthProvider('youtube').exchangeCode({ code: 'code123', redirectUri: REDIRECT });
    expect(result.accessToken).toBe('yt-access');
    expect(result.refreshToken).toBe('yt-refresh');
    expect(result.externalAccountId).toBe('UCchannel');
    expect(result.externalAccountLabel).toBe('My Channel');
    expect(result.expiresAt).not.toBeNull();
  });

  it('throws when Google does not return a refresh_token', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth');

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(makeResponse(true, 200, {
        access_token: 'yt-access',
        expires_in: 3600,
        scope: 'youtube.upload',
        // no refresh_token
      }))
    );

    await expect(
      getOAuthProvider('youtube').exchangeCode({ code: 'code123', redirectUri: REDIRECT })
    ).rejects.toThrow('refresh_token');
  });

  it('throws when the token exchange response is not ok', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth');

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(makeResponse(false, 400, { error: 'invalid_grant' }))
    );

    await expect(
      getOAuthProvider('youtube').exchangeCode({ code: 'badcode', redirectUri: REDIRECT })
    ).rejects.toThrow('YouTube token exchange failed');
  });

  it('handles missing channel gracefully (null accountId/label)', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth');

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(makeResponse(true, 200, {
        access_token: 'yt-access',
        refresh_token: 'yt-refresh',
        expires_in: 3600,
        scope: 'youtube.upload',
      }))
      .mockResolvedValueOnce(makeResponse(true, 200, { items: [] })) // no channel items
    );

    const result = await getOAuthProvider('youtube').exchangeCode({ code: 'code123', redirectUri: REDIRECT });
    expect(result.externalAccountId).toBeNull();
    expect(result.externalAccountLabel).toBeNull();
  });

  it('handles channel fetch failure gracefully (null accountId/label)', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth');

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(makeResponse(true, 200, {
        access_token: 'yt-access',
        refresh_token: 'yt-refresh',
        expires_in: 3600,
        scope: 'youtube.upload',
      }))
      .mockRejectedValueOnce(new Error('network error')) // channel fetch fails
    );

    const result = await getOAuthProvider('youtube').exchangeCode({ code: 'code123', redirectUri: REDIRECT });
    expect(result.externalAccountId).toBeNull();
  });
});

// ─── YouTube refreshAccessToken ───────────────────────────────────────────────

describe('youtubeProvider.refreshAccessToken', () => {
  beforeEach(() => { setEnv(); });
  afterEach(() => { clearEnv(); vi.unstubAllGlobals(); });

  it('returns a new access token', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth');

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(makeResponse(true, 200, {
        access_token: 'yt-new-access',
        expires_in: 3600,
      }))
    );

    const result = await getOAuthProvider('youtube').refreshAccessToken('old-refresh');
    expect(result.accessToken).toBe('yt-new-access');
    expect(result.expiresAt).not.toBeNull();
    expect(result.refreshToken).toBeNull(); // Google doesn't rotate by default
  });

  it('includes rotated refresh token if Google provides one', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth');

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(makeResponse(true, 200, {
        access_token: 'yt-new-access',
        refresh_token: 'yt-new-refresh',
        expires_in: 3600,
      }))
    );

    const result = await getOAuthProvider('youtube').refreshAccessToken('old-refresh');
    expect(result.refreshToken).toBe('yt-new-refresh');
  });

  it('throws when the refresh response is not ok', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth');

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(makeResponse(false, 401, { error: 'invalid_grant' }))
    );

    await expect(
      getOAuthProvider('youtube').refreshAccessToken('bad-refresh')
    ).rejects.toThrow('YouTube token refresh failed');
  });
});

// ─── TikTok exchangeCode ─────────────────────────────────────────────────────

describe('tiktokProvider.exchangeCode', () => {
  beforeEach(() => { setEnv(); });
  afterEach(() => { clearEnv(); vi.unstubAllGlobals(); });

  it('returns access token and user info on success', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth');

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(makeResponse(true, 200, {
        access_token: 'tt-access',
        refresh_token: 'tt-refresh',
        expires_in: 86400,
        open_id: 'tt-open-id-123',
        scope: 'video.publish',
      }))
      .mockResolvedValueOnce(makeResponse(true, 200, {
        data: { user: { display_name: 'TikTok Creator' } },
      }))
    );

    const result = await getOAuthProvider('tiktok').exchangeCode({ code: 'tt-code', redirectUri: REDIRECT });
    expect(result.accessToken).toBe('tt-access');
    expect(result.refreshToken).toBe('tt-refresh');
    expect(result.externalAccountId).toBe('tt-open-id-123');
    expect(result.externalAccountLabel).toBe('TikTok Creator');
    expect(result.expiresAt).not.toBeNull();
  });

  it('throws when TikTok returns an error body', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth');

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(makeResponse(false, 400, { error: 'invalid_client' }))
    );

    await expect(
      getOAuthProvider('tiktok').exchangeCode({ code: 'bad', redirectUri: REDIRECT })
    ).rejects.toThrow('TikTok token exchange failed');
  });

  it('handles missing display_name gracefully (null label)', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth');

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(makeResponse(true, 200, {
        access_token: 'tt-access',
        refresh_token: 'tt-refresh',
        open_id: 'tt-open-id',
        scope: 'video.publish',
        // no expires_in → expiresAt should be null
      }))
      .mockRejectedValueOnce(new Error('user info fetch failed'))
    );

    const result = await getOAuthProvider('tiktok').exchangeCode({ code: 'code', redirectUri: REDIRECT });
    expect(result.externalAccountLabel).toBeNull();
    expect(result.expiresAt).toBeNull();
  });
});

// ─── TikTok refreshAccessToken ────────────────────────────────────────────────

describe('tiktokProvider.refreshAccessToken', () => {
  beforeEach(() => { setEnv(); });
  afterEach(() => { clearEnv(); vi.unstubAllGlobals(); });

  it('returns new access token on success', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth');

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(makeResponse(true, 200, {
        access_token: 'tt-new-access',
        expires_in: 86400,
        refresh_token: 'tt-new-refresh',
      }))
    );

    const result = await getOAuthProvider('tiktok').refreshAccessToken('old-refresh');
    expect(result.accessToken).toBe('tt-new-access');
    expect(result.refreshToken).toBe('tt-new-refresh');
    expect(result.expiresAt).not.toBeNull();
  });

  it('throws on non-ok response', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth');

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(makeResponse(false, 401, { error: 'invalid_token' }))
    );

    await expect(
      getOAuthProvider('tiktok').refreshAccessToken('bad-refresh')
    ).rejects.toThrow('TikTok token refresh failed');
  });

  it('handles missing expires_in (null expiresAt)', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth');

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(makeResponse(true, 200, {
        access_token: 'tt-new-access',
        // no expires_in
      }))
    );

    const result = await getOAuthProvider('tiktok').refreshAccessToken('old-refresh');
    expect(result.expiresAt).toBeNull();
  });
});

// ─── Facebook exchangeCode ────────────────────────────────────────────────────

describe('facebookProvider.exchangeCode', () => {
  beforeEach(() => { setEnv(); });
  afterEach(() => { clearEnv(); vi.unstubAllGlobals(); });

  it('returns page access token and account info on success', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth');

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(makeResponse(true, 200, { access_token: 'short-lived' }))         // short-lived token
      .mockResolvedValueOnce(makeResponse(true, 200, { access_token: 'long-lived' }))          // long-lived token
      .mockResolvedValueOnce(makeResponse(true, 200, {
        data: [{ id: 'page-123', name: 'My Page', access_token: 'page-token' }],
      }))
    );

    const result = await getOAuthProvider('facebook').exchangeCode({ code: 'fb-code', redirectUri: REDIRECT });
    expect(result.accessToken).toBe('page-token');
    expect(result.refreshToken).toBe('long-lived'); // stored as pseudo refresh token
    expect(result.externalAccountId).toBe('page-123');
    expect(result.externalAccountLabel).toBe('My Page');
    expect(result.expiresAt).toBeNull();
  });

  it('throws when code exchange returns no access_token', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth');

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(makeResponse(true, 200, {})) // no access_token
    );

    await expect(
      getOAuthProvider('facebook').exchangeCode({ code: 'bad', redirectUri: REDIRECT })
    ).rejects.toThrow('no access_token');
  });

  it('throws when long-lived token exchange fails', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth');

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(makeResponse(true, 200, { access_token: 'short-lived' }))
      .mockResolvedValueOnce(makeResponse(true, 200, {})) // no long-lived access_token
    );

    await expect(
      getOAuthProvider('facebook').exchangeCode({ code: 'code', redirectUri: REDIRECT })
    ).rejects.toThrow('long-lived token exchange failed');
  });

  it('throws when there are no managed Pages', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth');

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(makeResponse(true, 200, { access_token: 'short-lived' }))
      .mockResolvedValueOnce(makeResponse(true, 200, { access_token: 'long-lived' }))
      .mockResolvedValueOnce(makeResponse(true, 200, { data: [] })) // no pages
    );

    await expect(
      getOAuthProvider('facebook').exchangeCode({ code: 'code', redirectUri: REDIRECT })
    ).rejects.toThrow('no Pages');
  });

  it('throws when Graph API returns an error body', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth');

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(makeResponse(false, 400, { error: { message: 'Invalid OAuth code' } }))
    );

    await expect(
      getOAuthProvider('facebook').exchangeCode({ code: 'bad', redirectUri: REDIRECT })
    ).rejects.toThrow('Facebook Graph API call failed');
  });
});

// ─── Facebook refreshAccessToken ─────────────────────────────────────────────

describe('facebookProvider.refreshAccessToken', () => {
  beforeEach(() => { setEnv(); });
  afterEach(() => { clearEnv(); vi.unstubAllGlobals(); });

  it('re-derives page token from stored long-lived user token', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth');

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(makeResponse(true, 200, {
        data: [{ id: 'page-123', name: 'My Page', access_token: 'renewed-page-token' }],
      }))
    );

    const result = await getOAuthProvider('facebook').refreshAccessToken('long-lived-user-token');
    expect(result.accessToken).toBe('renewed-page-token');
    expect(result.expiresAt).toBeNull();
    expect(result.refreshToken).toBeNull();
  });

  it('throws when the stored user token is no longer valid', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth');

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(makeResponse(true, 200, { data: [] })) // no pages → null
    );

    await expect(
      getOAuthProvider('facebook').refreshAccessToken('expired-user-token')
    ).rejects.toThrow('Reconnect Facebook');
  });
});

// ─── Canva exchangeCode ───────────────────────────────────────────────────────

describe('canvaProvider.exchangeCode', () => {
  beforeEach(() => { setEnv(); });
  afterEach(() => { clearEnv(); vi.unstubAllGlobals(); });

  it('returns access token and display name on success', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth');

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(makeResponse(true, 200, {
        access_token: 'cv-access',
        refresh_token: 'cv-refresh',
        expires_in: 3600,
        scope: 'design:content:write design:meta:read profile:read',
      }))
      .mockResolvedValueOnce(makeResponse(true, 200, { display_name: 'Canva User' }))
    );

    const result = await getOAuthProvider('canva').exchangeCode({
      code: 'cv-code',
      redirectUri: REDIRECT,
      codeVerifier: 'verifier-abc',
    });

    expect(result.accessToken).toBe('cv-access');
    expect(result.refreshToken).toBe('cv-refresh');
    expect(result.externalAccountLabel).toBe('Canva User');
    expect(result.externalAccountId).toBeNull(); // Connect API has no stable id
    expect(result.expiresAt).not.toBeNull();
  });

  it('throws when the token exchange response is not ok', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth');

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(makeResponse(false, 400, { message: 'Bad request' }))
    );

    await expect(
      getOAuthProvider('canva').exchangeCode({ code: 'bad', redirectUri: REDIRECT })
    ).rejects.toThrow('Canva token exchange failed');
  });

  it('falls back to null display name when profile fetch fails', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth');

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(makeResponse(true, 200, {
        access_token: 'cv-access',
        refresh_token: 'cv-refresh',
        expires_in: 3600,
        scope: 'profile:read',
      }))
      .mockResolvedValueOnce(makeResponse(false, 500, {})) // profile fetch fails
    );

    const result = await getOAuthProvider('canva').exchangeCode({
      code: 'cv-code',
      redirectUri: REDIRECT,
    });

    expect(result.externalAccountLabel).toBeNull();
  });
});

// ─── Canva refreshAccessToken ─────────────────────────────────────────────────

describe('canvaProvider.refreshAccessToken', () => {
  beforeEach(() => { setEnv(); });
  afterEach(() => { clearEnv(); vi.unstubAllGlobals(); });

  it('returns a new access token on success', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth');

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(makeResponse(true, 200, {
        access_token: 'cv-new-access',
        expires_in: 3600,
        refresh_token: 'cv-new-refresh',
      }))
    );

    const result = await getOAuthProvider('canva').refreshAccessToken('old-cv-refresh');
    expect(result.accessToken).toBe('cv-new-access');
    expect(result.refreshToken).toBe('cv-new-refresh');
    expect(result.expiresAt).not.toBeNull();
  });

  it('throws when the refresh response is not ok', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth');

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(makeResponse(false, 401, {}))
    );

    await expect(
      getOAuthProvider('canva').refreshAccessToken('bad-refresh')
    ).rejects.toThrow('Canva token refresh failed');
  });

  it('returns null refreshToken when provider does not rotate it', async () => {
    const { getOAuthProvider } = await import('@/lib/oauth');

    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(makeResponse(true, 200, {
        access_token: 'cv-new-access',
        expires_in: 3600,
        // no refresh_token in response
      }))
    );

    const result = await getOAuthProvider('canva').refreshAccessToken('old-cv-refresh');
    expect(result.refreshToken).toBeNull();
  });
});
