/**
 * Tests for exchangeCode() and refreshAccessToken() on each OAuth provider.
 * These methods make network calls so we stub globalThis.fetch.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { youtubeProvider } from '@/lib/oauth/youtube';
import { tiktokProvider } from '@/lib/oauth/tiktok';
import { facebookProvider } from '@/lib/oauth/facebook';
import { canvaProvider } from '@/lib/oauth/canva';

const REDIRECT_URI = 'https://app.example.com/api/oauth/callback';

// ── YouTube exchangeCode / refreshAccessToken ─────────────────────────────

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

  it('exchanges code successfully and returns token fields', async () => {
    const tokenBody = {
      access_token: 'yt-access',
      refresh_token: 'yt-refresh',
      expires_in: 3600,
      scope: 'https://www.googleapis.com/auth/youtube.upload',
    };
    const channelBody = { items: [{ id: 'ch-1', snippet: { title: 'My Channel' } }] };

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => tokenBody }) // token endpoint
        .mockResolvedValueOnce({ ok: true, json: async () => channelBody }) // channels endpoint
    );

    const result = await youtubeProvider.exchangeCode({ code: 'auth-code', redirectUri: REDIRECT_URI });

    expect(result.accessToken).toBe('yt-access');
    expect(result.refreshToken).toBe('yt-refresh');
    expect(result.externalAccountId).toBe('ch-1');
    expect(result.externalAccountLabel).toBe('My Channel');
    expect(result.expiresAt).toBeTruthy();
    expect(result.scope).toContain('youtube.upload');
  });

  it('throws when token endpoint returns no refresh_token', async () => {
    const tokenBody = { access_token: 'yt-access', expires_in: 3600 }; // no refresh_token

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => tokenBody }));

    await expect(youtubeProvider.exchangeCode({ code: 'auth-code', redirectUri: REDIRECT_URI })).rejects.toThrow(
      'refresh_token'
    );
  });

  it('throws when token endpoint returns a non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: false, status: 400, text: async () => 'bad request' })
    );

    await expect(youtubeProvider.exchangeCode({ code: 'bad-code', redirectUri: REDIRECT_URI })).rejects.toThrow(
      'YouTube token exchange failed'
    );
  });

  it('works even when channel fetch fails (externalAccountId = null)', async () => {
    const tokenBody = {
      access_token: 'yt-access',
      refresh_token: 'yt-refresh',
      expires_in: 3600,
      scope: 'https://www.googleapis.com/auth/youtube.upload',
    };

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => tokenBody })
        .mockResolvedValueOnce({ ok: false, status: 403 }) // channel fetch fails
    );

    const result = await youtubeProvider.exchangeCode({ code: 'auth-code', redirectUri: REDIRECT_URI });
    expect(result.accessToken).toBe('yt-access');
    expect(result.externalAccountId).toBeNull();
    expect(result.externalAccountLabel).toBeNull();
  });

  it('works when channel items list is empty', async () => {
    const tokenBody = { access_token: 'yt-access', refresh_token: 'yt-refresh', expires_in: 3600, scope: 'youtube' };
    const channelBody = { items: [] };

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => tokenBody })
        .mockResolvedValueOnce({ ok: true, json: async () => channelBody })
    );

    const result = await youtubeProvider.exchangeCode({ code: 'auth-code', redirectUri: REDIRECT_URI });
    expect(result.externalAccountId).toBeNull();
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

  it('returns new access token on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'yt-new-access', expires_in: 3600 }),
      })
    );

    const result = await youtubeProvider.refreshAccessToken('yt-old-refresh');
    expect(result.accessToken).toBe('yt-new-access');
    expect(result.expiresAt).toBeTruthy();
    expect(result.refreshToken).toBeNull(); // Google rarely rotates
  });

  it('propagates rotated refresh token when Google issues one', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'yt-new-access', expires_in: 3600, refresh_token: 'yt-new-refresh' }),
      })
    );

    const result = await youtubeProvider.refreshAccessToken('yt-old-refresh');
    expect(result.refreshToken).toBe('yt-new-refresh');
  });

  it('throws when refresh endpoint returns non-ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'invalid_grant' })
    );

    await expect(youtubeProvider.refreshAccessToken('bad-token')).rejects.toThrow('YouTube token refresh failed');
  });
});

// ── TikTok exchangeCode / refreshAccessToken ──────────────────────────────

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

  it('exchanges code and returns token fields', async () => {
    const tokenBody = {
      access_token: 'tt-access',
      refresh_token: 'tt-refresh',
      expires_in: 86400,
      open_id: 'tt-user-id',
      scope: 'video.publish',
    };
    const userBody = { data: { user: { display_name: 'TikTok Creator' } } };

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => tokenBody })
        .mockResolvedValueOnce({ ok: true, json: async () => userBody })
    );

    const result = await tiktokProvider.exchangeCode({ code: 'auth-code', redirectUri: REDIRECT_URI });
    expect(result.accessToken).toBe('tt-access');
    expect(result.refreshToken).toBe('tt-refresh');
    expect(result.externalAccountId).toBe('tt-user-id');
    expect(result.externalAccountLabel).toBe('TikTok Creator');
    expect(result.expiresAt).toBeTruthy();
  });

  it('handles missing open_id (externalAccountId = null)', async () => {
    const tokenBody = { access_token: 'tt-access', refresh_token: 'tt-refresh', expires_in: 86400, scope: 'video.publish' };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => tokenBody })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ data: {} }) })
    );

    const result = await tiktokProvider.exchangeCode({ code: 'auth-code', redirectUri: REDIRECT_URI });
    expect(result.externalAccountId).toBeNull();
  });

  it('handles null expires_in (expiresAt = null)', async () => {
    const tokenBody = { access_token: 'tt-access', refresh_token: 'tt-refresh', scope: 'video.publish' };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => tokenBody })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ data: {} }) })
    );

    const result = await tiktokProvider.exchangeCode({ code: 'auth-code', redirectUri: REDIRECT_URI });
    expect(result.expiresAt).toBeNull();
  });

  it('throws when token endpoint returns error body', async () => {
    const errBody = { error: 'invalid_grant', error_description: 'Code expired' };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: false, status: 400, json: async () => errBody })
    );

    await expect(tiktokProvider.exchangeCode({ code: 'bad', redirectUri: REDIRECT_URI })).rejects.toThrow(
      'TikTok token exchange failed'
    );
  });

  it('works when display name fetch fails (externalAccountLabel = null)', async () => {
    const tokenBody = { access_token: 'tt-access', refresh_token: 'tt-refresh', expires_in: 3600, scope: 'video.publish' };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => tokenBody })
        .mockRejectedValueOnce(new Error('network error'))
    );

    const result = await tiktokProvider.exchangeCode({ code: 'auth-code', redirectUri: REDIRECT_URI });
    expect(result.externalAccountLabel).toBeNull();
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

  it('returns a new access token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'tt-new-access', expires_in: 86400 }),
      })
    );

    const result = await tiktokProvider.refreshAccessToken('tt-old-refresh');
    expect(result.accessToken).toBe('tt-new-access');
    expect(result.expiresAt).toBeTruthy();
  });

  it('throws when refresh endpoint returns an error body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: 'invalid_token' }),
      })
    );

    await expect(tiktokProvider.refreshAccessToken('bad-refresh')).rejects.toThrow('TikTok token refresh failed');
  });
});

// ── Facebook exchangeCode / refreshAccessToken ────────────────────────────

describe('facebookProvider.exchangeCode()', () => {
  beforeEach(() => {
    process.env.FACEBOOK_APP_ID = 'fb-app';
    process.env.FACEBOOK_APP_SECRET = 'fb-secret';
  });
  afterEach(() => {
    delete process.env.FACEBOOK_APP_ID;
    delete process.env.FACEBOOK_APP_SECRET;
    vi.restoreAllMocks();
  });

  it('exchanges code and returns page token', async () => {
    const shortLived = { access_token: 'short-token' };
    const longLived = { access_token: 'long-token' };
    const pages = { data: [{ id: 'page-1', name: 'My Page', access_token: 'page-token' }] };

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => shortLived }) // short-lived token
        .mockResolvedValueOnce({ ok: true, json: async () => longLived }) // long-lived token
        .mockResolvedValueOnce({ ok: true, json: async () => pages }) // /me/accounts
    );

    const result = await facebookProvider.exchangeCode({ code: 'auth-code', redirectUri: REDIRECT_URI });
    expect(result.accessToken).toBe('page-token');
    expect(result.refreshToken).toBe('long-token'); // stored for re-derivation
    expect(result.externalAccountId).toBe('page-1');
    expect(result.externalAccountLabel).toBe('My Page');
    expect(result.expiresAt).toBeNull();
  });

  it('throws when the short-lived token exchange returns an error', async () => {
    // getJson throws "Facebook Graph API call failed" when body.error is truthy
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: { message: 'bad code' } }) }));

    await expect(facebookProvider.exchangeCode({ code: 'bad', redirectUri: REDIRECT_URI })).rejects.toThrow(
      'Facebook Graph API call failed'
    );
  });

  it('throws when the short-lived response is ok but has no access_token', async () => {
    // Returns ok + no error + no access_token → explicit check in exchangeCode
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({}) }));

    await expect(facebookProvider.exchangeCode({ code: 'bad', redirectUri: REDIRECT_URI })).rejects.toThrow(
      'Facebook code exchange returned no access_token'
    );
  });

  it('throws when the long-lived response is ok but has no access_token', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'short' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // long-lived: ok but no access_token
    );

    await expect(facebookProvider.exchangeCode({ code: 'c', redirectUri: REDIRECT_URI })).rejects.toThrow(
      'Facebook long-lived token exchange failed'
    );
  });

  it('throws when the user has no managed Pages', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'short' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'long' }) })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) }) // empty pages
    );

    await expect(facebookProvider.exchangeCode({ code: 'c', redirectUri: REDIRECT_URI })).rejects.toThrow(
      'no Pages'
    );
  });
});

describe('facebookProvider.refreshAccessToken()', () => {
  beforeEach(() => {
    process.env.FACEBOOK_APP_ID = 'fb-app';
    process.env.FACEBOOK_APP_SECRET = 'fb-secret';
  });
  afterEach(() => {
    delete process.env.FACEBOOK_APP_ID;
    delete process.env.FACEBOOK_APP_SECRET;
    vi.restoreAllMocks();
  });

  it('re-derives page token from the stored long-lived user token', async () => {
    const pages = { data: [{ id: 'page-1', name: 'My Page', access_token: 'new-page-token' }] };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => pages }));

    const result = await facebookProvider.refreshAccessToken('long-lived-user-token');
    expect(result.accessToken).toBe('new-page-token');
    expect(result.expiresAt).toBeNull();
    expect(result.refreshToken).toBeNull();
  });

  it('throws when the stored long-lived token is no longer valid', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) }));

    await expect(facebookProvider.refreshAccessToken('expired-user-token')).rejects.toThrow('no longer valid');
  });
});

// ── Canva exchangeCode / refreshAccessToken ───────────────────────────────

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

  it('exchanges code and returns token fields', async () => {
    const tokenBody = {
      access_token: 'canva-access',
      refresh_token: 'canva-refresh',
      expires_in: 3600,
      scope: 'design:content:write design:meta:read profile:read',
    };
    const profileBody = { display_name: 'Canva User' };

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => tokenBody })
        .mockResolvedValueOnce({ ok: true, json: async () => profileBody })
    );

    const result = await canvaProvider.exchangeCode({
      code: 'auth-code',
      redirectUri: REDIRECT_URI,
      codeVerifier: 'verifier-abc',
    });

    expect(result.accessToken).toBe('canva-access');
    expect(result.refreshToken).toBe('canva-refresh');
    expect(result.externalAccountLabel).toBe('Canva User');
    expect(result.expiresAt).toBeTruthy();
  });

  it('returns null externalAccountLabel when profile fetch fails', async () => {
    const tokenBody = { access_token: 'canva-access', refresh_token: 'canva-refresh', expires_in: 3600 };

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => tokenBody })
        .mockResolvedValueOnce({ ok: false, status: 403 })
    );

    const result = await canvaProvider.exchangeCode({
      code: 'auth-code',
      redirectUri: REDIRECT_URI,
      codeVerifier: 'verifier-abc',
    });

    expect(result.externalAccountLabel).toBeNull();
    expect(result.externalAccountId).toBeNull(); // Connect API doesn't expose user id
  });

  it('throws when token endpoint returns non-ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: false, status: 400, text: async () => 'invalid_grant' })
    );

    await expect(
      canvaProvider.exchangeCode({ code: 'bad', redirectUri: REDIRECT_URI, codeVerifier: 'v' })
    ).rejects.toThrow('Canva token exchange failed');
  });

  it('uses fallback scope from constant when scope absent in response', async () => {
    const tokenBody = { access_token: 'canva-access', refresh_token: 'canva-refresh', expires_in: 3600 };

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => tokenBody })
        .mockResolvedValueOnce({ ok: true, json: async () => ({ display_name: null }) })
    );

    const result = await canvaProvider.exchangeCode({
      code: 'auth-code',
      redirectUri: REDIRECT_URI,
      codeVerifier: 'verifier-abc',
    });

    expect(result.scope).toContain('design:content:write');
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

  it('returns a new access token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'canva-new-access', expires_in: 3600 }),
      })
    );

    const result = await canvaProvider.refreshAccessToken('canva-old-refresh');
    expect(result.accessToken).toBe('canva-new-access');
    expect(result.expiresAt).toBeTruthy();
    expect(result.refreshToken).toBeNull();
  });

  it('propagates a rotated refresh token when present', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'new-access', expires_in: 3600, refresh_token: 'new-refresh' }),
      })
    );

    const result = await canvaProvider.refreshAccessToken('old-refresh');
    expect(result.refreshToken).toBe('new-refresh');
  });

  it('throws when refresh endpoint returns non-ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({ ok: false, status: 401, text: async () => 'invalid_token' })
    );

    await expect(canvaProvider.refreshAccessToken('bad-refresh')).rejects.toThrow('Canva token refresh failed');
  });
});
