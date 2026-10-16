/**
 * Tests for exchangeCode() and refreshAccessToken() on each OAuth provider.
 * All fetch calls are intercepted via vi.stubGlobal('fetch', ...).
 *
 * requireEnv() is exercised via process.env — env vars are set in beforeEach
 * and cleaned up in afterEach.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getOAuthProvider } from '@/lib/oauth';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function textResponse(text: string, status: number): Response {
  return new Response(text, { status });
}

// ── YouTube ───────────────────────────────────────────────────────────────────

describe('youtubeProvider.exchangeCode', () => {
  beforeEach(() => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'yt-client';
    process.env.YOUTUBE_OAUTH_CLIENT_SECRET = 'yt-secret';
  });
  afterEach(() => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    delete process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
    vi.unstubAllGlobals();
  });

  it('returns a TokenExchangeResult with refresh_token', async () => {
    vi.stubGlobal('fetch', vi.fn()
      // First call: token endpoint
      .mockResolvedValueOnce(jsonResponse({
        access_token: 'at-123',
        refresh_token: 'rt-456',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/youtube.upload',
      }))
      // Second call: channel lookup
      .mockResolvedValueOnce(jsonResponse({
        items: [{ id: 'channel-1', snippet: { title: 'My Channel' } }],
      }))
    );
    const provider = getOAuthProvider('youtube');
    const result = await provider.exchangeCode({ code: 'auth-code', redirectUri: 'https://example.com/cb' });
    expect(result.accessToken).toBe('at-123');
    expect(result.refreshToken).toBe('rt-456');
    expect(result.externalAccountId).toBe('channel-1');
    expect(result.externalAccountLabel).toBe('My Channel');
    expect(result.scope).toContain('youtube.upload');
    expect(typeof result.expiresAt).toBe('string');
  });

  it('uses channel id as label when snippet title is missing', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        access_token: 'at-123',
        refresh_token: 'rt-456',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/youtube.upload',
      }))
      .mockResolvedValueOnce(jsonResponse({
        items: [{ id: 'channel-1', snippet: {} }],
      }))
    );
    const result = await getOAuthProvider('youtube').exchangeCode({ code: 'c', redirectUri: 'https://r.com' });
    expect(result.externalAccountLabel).toBe('channel-1');
  });

  it('sets externalAccountId/Label to null when channel lookup fails', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        access_token: 'at-123',
        refresh_token: 'rt-456',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/youtube.upload',
      }))
      // Channel lookup returns non-ok status
      .mockResolvedValueOnce(jsonResponse({}, 403))
    );
    const result = await getOAuthProvider('youtube').exchangeCode({ code: 'c', redirectUri: 'https://r.com' });
    expect(result.externalAccountId).toBeNull();
    expect(result.externalAccountLabel).toBeNull();
  });

  it('throws when token endpoint returns non-ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(textResponse('bad_request', 400)));
    await expect(
      getOAuthProvider('youtube').exchangeCode({ code: 'c', redirectUri: 'https://r.com' })
    ).rejects.toThrow('YouTube token exchange failed');
  });

  it('throws when response body has no refresh_token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({
      access_token: 'at-123',
      expires_in: 3600,
      scope: 'https://www.googleapis.com/auth/youtube.upload',
      // no refresh_token
    })));
    await expect(
      getOAuthProvider('youtube').exchangeCode({ code: 'c', redirectUri: 'https://r.com' })
    ).rejects.toThrow('refresh_token');
  });

  it('sets externalAccountId/Label to null when channel items is empty', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        access_token: 'at',
        refresh_token: 'rt',
        expires_in: 3600,
        scope: 's',
      }))
      .mockResolvedValueOnce(jsonResponse({ items: [] }))
    );
    const result = await getOAuthProvider('youtube').exchangeCode({ code: 'c', redirectUri: 'r' });
    expect(result.externalAccountId).toBeNull();
    expect(result.externalAccountLabel).toBeNull();
  });

  it('sets externalAccountId/Label to null when channel fetch throws (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        access_token: 'at',
        refresh_token: 'rt',
        expires_in: 3600,
        scope: 's',
      }))
      .mockRejectedValueOnce(new Error('Network error during channel lookup'))
    );
    const result = await getOAuthProvider('youtube').exchangeCode({ code: 'c', redirectUri: 'r' });
    expect(result.externalAccountId).toBeNull();
    expect(result.externalAccountLabel).toBeNull();
  });
});

describe('youtubeProvider.refreshAccessToken', () => {
  beforeEach(() => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'yt-client';
    process.env.YOUTUBE_OAUTH_CLIENT_SECRET = 'yt-secret';
  });
  afterEach(() => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    delete process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
    vi.unstubAllGlobals();
  });

  it('returns new accessToken and expiresAt', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({
      access_token: 'new-at',
      expires_in: 3600,
    })));
    const result = await getOAuthProvider('youtube').refreshAccessToken('old-rt');
    expect(result.accessToken).toBe('new-at');
    expect(typeof result.expiresAt).toBe('string');
    expect(result.refreshToken).toBeNull();
  });

  it('returns a rotated refreshToken when Google provides one', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({
      access_token: 'new-at',
      expires_in: 3600,
      refresh_token: 'new-rt',
    })));
    const result = await getOAuthProvider('youtube').refreshAccessToken('old-rt');
    expect(result.refreshToken).toBe('new-rt');
  });

  it('throws on non-ok token refresh response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(textResponse('invalid_grant', 400)));
    await expect(
      getOAuthProvider('youtube').refreshAccessToken('bad-rt')
    ).rejects.toThrow('YouTube token refresh failed');
  });
});

// ── TikTok ────────────────────────────────────────────────────────────────────

describe('tiktokProvider.exchangeCode', () => {
  beforeEach(() => {
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'tt-key';
    process.env.TIKTOK_OAUTH_CLIENT_SECRET = 'tt-secret';
  });
  afterEach(() => {
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    delete process.env.TIKTOK_OAUTH_CLIENT_SECRET;
    vi.unstubAllGlobals();
  });

  it('returns a TokenExchangeResult', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        access_token: 'tt-at',
        refresh_token: 'tt-rt',
        expires_in: 86400,
        open_id: 'tt-user-1',
        scope: 'video.publish',
      }))
      .mockResolvedValueOnce(jsonResponse({ data: { user: { display_name: 'TikTok Creator' } } }))
    );
    const result = await getOAuthProvider('tiktok').exchangeCode({ code: 'c', redirectUri: 'r' });
    expect(result.accessToken).toBe('tt-at');
    expect(result.refreshToken).toBe('tt-rt');
    expect(result.externalAccountId).toBe('tt-user-1');
    expect(result.externalAccountLabel).toBe('TikTok Creator');
  });

  it('sets externalAccountLabel to null when display_name fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        access_token: 'tt-at',
        refresh_token: 'tt-rt',
        expires_in: 86400,
        open_id: 'tt-user-1',
        scope: 'video.publish',
      }))
      .mockResolvedValueOnce(jsonResponse({}, 403))
    );
    const result = await getOAuthProvider('tiktok').exchangeCode({ code: 'c', redirectUri: 'r' });
    expect(result.externalAccountLabel).toBeNull();
  });

  it('sets expiresAt to null when expires_in is missing', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        access_token: 'tt-at',
        refresh_token: 'tt-rt',
        scope: 'video.publish',
      }))
      .mockResolvedValueOnce(jsonResponse({ data: { user: {} } }))
    );
    const result = await getOAuthProvider('tiktok').exchangeCode({ code: 'c', redirectUri: 'r' });
    expect(result.expiresAt).toBeNull();
  });

  it('throws on error body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({ error: 'invalid_code' }, 400)));
    await expect(
      getOAuthProvider('tiktok').exchangeCode({ code: 'bad', redirectUri: 'r' })
    ).rejects.toThrow('TikTok token exchange failed');
  });

  it('sets refreshToken to null when not in response', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        access_token: 'tt-at',
        expires_in: 3600,
        open_id: 'u1',
        scope: 'video.publish',
      }))
      .mockResolvedValueOnce(jsonResponse({ data: { user: { display_name: 'X' } } }))
    );
    const result = await getOAuthProvider('tiktok').exchangeCode({ code: 'c', redirectUri: 'r' });
    expect(result.refreshToken).toBeNull();
  });

  it('sets label to null when fetchDisplayName throws (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        access_token: 'tt-at',
        refresh_token: 'rt',
        expires_in: 3600,
        open_id: 'u1',
        scope: 'video.publish',
      }))
      .mockRejectedValueOnce(new Error('Network timeout'))
    );
    const result = await getOAuthProvider('tiktok').exchangeCode({ code: 'c', redirectUri: 'r' });
    expect(result.externalAccountLabel).toBeNull();
  });
});

describe('tiktokProvider.refreshAccessToken', () => {
  beforeEach(() => {
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'tt-key';
    process.env.TIKTOK_OAUTH_CLIENT_SECRET = 'tt-secret';
  });
  afterEach(() => {
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    delete process.env.TIKTOK_OAUTH_CLIENT_SECRET;
    vi.unstubAllGlobals();
  });

  it('returns new accessToken', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({
      access_token: 'new-tt-at',
      expires_in: 86400,
    })));
    const result = await getOAuthProvider('tiktok').refreshAccessToken('old-rt');
    expect(result.accessToken).toBe('new-tt-at');
    expect(result.refreshToken).toBeNull();
  });

  it('returns rotated refresh token when provided', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({
      access_token: 'new-tt-at',
      expires_in: 86400,
      refresh_token: 'new-tt-rt',
    })));
    const result = await getOAuthProvider('tiktok').refreshAccessToken('old-rt');
    expect(result.refreshToken).toBe('new-tt-rt');
  });

  it('throws on non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({ error: 'token_expired' }, 401)));
    await expect(
      getOAuthProvider('tiktok').refreshAccessToken('bad-rt')
    ).rejects.toThrow('TikTok token refresh failed');
  });

  it('sets expiresAt to null when expires_in is missing in refresh', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({
      access_token: 'new-at',
    })));
    const result = await getOAuthProvider('tiktok').refreshAccessToken('rt');
    expect(result.expiresAt).toBeNull();
  });
});

// ── Facebook ──────────────────────────────────────────────────────────────────

describe('facebookProvider.exchangeCode', () => {
  beforeEach(() => {
    process.env.FACEBOOK_APP_ID = 'fb-app';
    process.env.FACEBOOK_APP_SECRET = 'fb-secret';
  });
  afterEach(() => {
    delete process.env.FACEBOOK_APP_ID;
    delete process.env.FACEBOOK_APP_SECRET;
    vi.unstubAllGlobals();
  });

  it('returns a TokenExchangeResult with page token', async () => {
    vi.stubGlobal('fetch', vi.fn()
      // short-lived token exchange
      .mockResolvedValueOnce(jsonResponse({ access_token: 'short-lived-token' }))
      // long-lived token exchange
      .mockResolvedValueOnce(jsonResponse({ access_token: 'long-lived-token' }))
      // /me/accounts
      .mockResolvedValueOnce(jsonResponse({
        data: [{ id: 'page-1', name: 'My Page', access_token: 'page-token' }],
      }))
    );
    const result = await getOAuthProvider('facebook').exchangeCode({ code: 'c', redirectUri: 'r' });
    expect(result.accessToken).toBe('page-token');
    expect(result.refreshToken).toBe('long-lived-token');
    expect(result.externalAccountId).toBe('page-1');
    expect(result.externalAccountLabel).toBe('My Page');
    expect(result.expiresAt).toBeNull();
  });

  it('throws when short-lived token exchange returns no access_token (no error field)', async () => {
    // getJson does not throw when res.ok && !body.error;
    // the check for missing access_token at line 52 fires instead.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({ token_type: 'bearer' })));
    await expect(
      getOAuthProvider('facebook').exchangeCode({ code: 'c', redirectUri: 'r' })
    ).rejects.toThrow('no access_token');
  });

  it('throws when long-lived token exchange returns an error', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'short' }))
      .mockResolvedValueOnce(jsonResponse({ error: 'exchange_failed' }))
    );
    await expect(
      getOAuthProvider('facebook').exchangeCode({ code: 'c', redirectUri: 'r' })
    ).rejects.toThrow('Facebook Graph API call failed');
  });

  it('throws when user has no Pages', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'short' }))
      .mockResolvedValueOnce(jsonResponse({ access_token: 'long' }))
      .mockResolvedValueOnce(jsonResponse({ data: [] }))
    );
    await expect(
      getOAuthProvider('facebook').exchangeCode({ code: 'c', redirectUri: 'r' })
    ).rejects.toThrow('no Pages');
  });

  it('throws when long-lived exchange body has no access_token and no error (line 62)', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'short' }))
      .mockResolvedValueOnce(jsonResponse({ token_type: 'bearer' })) // no access_token, no error
    );
    await expect(
      getOAuthProvider('facebook').exchangeCode({ code: 'c', redirectUri: 'r' })
    ).rejects.toThrow('long-lived token exchange failed');
  });

  it('uses page id as label when name is not present', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'short' }))
      .mockResolvedValueOnce(jsonResponse({ access_token: 'long' }))
      .mockResolvedValueOnce(jsonResponse({
        data: [{ id: 'page-99', access_token: 'pt' }], // no name
      }))
    );
    const result = await getOAuthProvider('facebook').exchangeCode({ code: 'c', redirectUri: 'r' });
    expect(result.externalAccountLabel).toBe('page-99');
  });
});

describe('facebookProvider.refreshAccessToken', () => {
  beforeEach(() => {
    process.env.FACEBOOK_APP_ID = 'fb-app';
    process.env.FACEBOOK_APP_SECRET = 'fb-secret';
  });
  afterEach(() => {
    delete process.env.FACEBOOK_APP_ID;
    delete process.env.FACEBOOK_APP_SECRET;
    vi.unstubAllGlobals();
  });

  it('re-derives page token from long-lived user token', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        data: [{ id: 'page-2', name: 'Page Two', access_token: 'page-token-2' }],
      }))
    );
    const result = await getOAuthProvider('facebook').refreshAccessToken('long-lived-user-token');
    expect(result.accessToken).toBe('page-token-2');
    expect(result.expiresAt).toBeNull();
    expect(result.refreshToken).toBeNull();
  });

  it('throws when long-lived user token has expired (no pages)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({ data: [] })));
    await expect(
      getOAuthProvider('facebook').refreshAccessToken('expired-user-token')
    ).rejects.toThrow('Reconnect Facebook');
  });
});

// ── Canva ─────────────────────────────────────────────────────────────────────

describe('canvaProvider.exchangeCode', () => {
  beforeEach(() => {
    process.env.CANVA_CLIENT_ID = 'canva-id';
    process.env.CANVA_CLIENT_SECRET = 'canva-secret';
  });
  afterEach(() => {
    delete process.env.CANVA_CLIENT_ID;
    delete process.env.CANVA_CLIENT_SECRET;
    vi.unstubAllGlobals();
  });

  it('returns a TokenExchangeResult', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        access_token: 'canva-at',
        refresh_token: 'canva-rt',
        expires_in: 3600,
        scope: 'design:content:write profile:read',
      }))
      .mockResolvedValueOnce(jsonResponse({ display_name: 'Canva User' }))
    );
    const result = await getOAuthProvider('canva').exchangeCode({
      code: 'c',
      redirectUri: 'r',
      codeVerifier: 'verifier-abc',
    });
    expect(result.accessToken).toBe('canva-at');
    expect(result.refreshToken).toBe('canva-rt');
    expect(result.externalAccountLabel).toBe('Canva User');
    expect(result.externalAccountId).toBeNull(); // Canva doesn't expose a stable id
  });

  it('sets label to null when display_name fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        access_token: 'at',
        refresh_token: 'rt',
        expires_in: 3600,
        scope: 's',
      }))
      .mockResolvedValueOnce(jsonResponse({}, 403))
    );
    const result = await getOAuthProvider('canva').exchangeCode({ code: 'c', redirectUri: 'r' });
    expect(result.externalAccountLabel).toBeNull();
  });

  it('sets refreshToken to null when not in response', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse({ access_token: 'at', expires_in: 3600, scope: 's' }))
      .mockResolvedValueOnce(jsonResponse({ display_name: 'X' }))
    );
    const result = await getOAuthProvider('canva').exchangeCode({ code: 'c', redirectUri: 'r' });
    expect(result.refreshToken).toBeNull();
  });

  it('throws on non-ok token exchange', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(textResponse('Unauthorized', 401)));
    await expect(
      getOAuthProvider('canva').exchangeCode({ code: 'bad', redirectUri: 'r' })
    ).rejects.toThrow('Canva token exchange failed');
  });

  it('sets label to null when fetchDisplayName throws (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        access_token: 'at',
        refresh_token: 'rt',
        expires_in: 3600,
        scope: 's',
      }))
      .mockRejectedValueOnce(new Error('DNS failure'))
    );
    const result = await getOAuthProvider('canva').exchangeCode({ code: 'c', redirectUri: 'r' });
    expect(result.externalAccountLabel).toBeNull();
  });
});

describe('canvaProvider.refreshAccessToken', () => {
  beforeEach(() => {
    process.env.CANVA_CLIENT_ID = 'canva-id';
    process.env.CANVA_CLIENT_SECRET = 'canva-secret';
  });
  afterEach(() => {
    delete process.env.CANVA_CLIENT_ID;
    delete process.env.CANVA_CLIENT_SECRET;
    vi.unstubAllGlobals();
  });

  it('returns new accessToken and expiresAt', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({
      access_token: 'new-canva-at',
      expires_in: 3600,
    })));
    const result = await getOAuthProvider('canva').refreshAccessToken('old-rt');
    expect(result.accessToken).toBe('new-canva-at');
    expect(typeof result.expiresAt).toBe('string');
    expect(result.refreshToken).toBeNull();
  });

  it('returns rotated refresh token when provided', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(jsonResponse({
      access_token: 'new-at',
      expires_in: 3600,
      refresh_token: 'new-rt',
    })));
    const result = await getOAuthProvider('canva').refreshAccessToken('old-rt');
    expect(result.refreshToken).toBe('new-rt');
  });

  it('throws on non-ok refresh response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(textResponse('expired', 401)));
    await expect(
      getOAuthProvider('canva').refreshAccessToken('bad-rt')
    ).rejects.toThrow('Canva token refresh failed');
  });
});
