/**
 * Tests for the network-dependent parts of each OAuth provider.
 * fetch is stubbed at the global level so no real HTTP calls are made.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getOAuthProvider } from '@/lib/oauth';

// Helper to create a mocked fetch Response
function mockFetch(...responses: Array<{ ok: boolean; status?: number; body: unknown; headers?: Record<string, string> }>) {
  let call = 0;
  return vi.fn().mockImplementation(() => {
    const r = responses[Math.min(call++, responses.length - 1)];
    return Promise.resolve({
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 400),
      json: () => Promise.resolve(r.body),
      text: () => Promise.resolve(JSON.stringify(r.body)),
      headers: {
        get: (name: string) => (r.headers ?? {})[name] ?? null,
      },
    });
  });
}

// ─── YouTube ─────────────────────────────────────────────────────────────────

describe('youtubeProvider.exchangeCode()', () => {
  const tokenBody = {
    access_token: 'yt-access',
    refresh_token: 'yt-refresh',
    expires_in: 3600,
    scope: 'https://www.googleapis.com/auth/youtube.upload',
  };
  const channelBody = {
    items: [{ id: 'UCxxx', snippet: { title: 'My Channel' } }],
  };

  beforeEach(() => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'yt-id';
    process.env.YOUTUBE_OAUTH_CLIENT_SECRET = 'yt-secret';
  });
  afterEach(() => vi.restoreAllMocks());

  it('returns tokens on success', async () => {
    vi.stubGlobal('fetch', mockFetch({ ok: true, body: tokenBody }, { ok: true, body: channelBody }));
    const result = await getOAuthProvider('youtube').exchangeCode({ code: 'code', redirectUri: 'https://r.example.com' });
    expect(result.accessToken).toBe('yt-access');
    expect(result.refreshToken).toBe('yt-refresh');
    expect(result.externalAccountId).toBe('UCxxx');
    expect(result.externalAccountLabel).toBe('My Channel');
    expect(result.scope).toBe('https://www.googleapis.com/auth/youtube.upload');
    expect(result.expiresAt).toBeTruthy();
  });

  it('throws when token exchange fails', async () => {
    vi.stubGlobal('fetch', mockFetch({ ok: false, status: 400, body: { error: 'invalid_grant' } }));
    await expect(
      getOAuthProvider('youtube').exchangeCode({ code: 'bad', redirectUri: 'https://r.example.com' })
    ).rejects.toThrow('YouTube token exchange failed');
  });

  it('throws when Google does not return a refresh_token', async () => {
    vi.stubGlobal('fetch', mockFetch(
      { ok: true, body: { access_token: 'at', expires_in: 3600, scope: 'x' } },
      { ok: true, body: channelBody }
    ));
    await expect(
      getOAuthProvider('youtube').exchangeCode({ code: 'code', redirectUri: 'https://r.example.com' })
    ).rejects.toThrow('refresh_token');
  });

  it('handles missing channel gracefully (fetchOwnChannel returns null)', async () => {
    vi.stubGlobal('fetch', mockFetch(
      { ok: true, body: tokenBody },
      { ok: false, status: 403, body: {} }  // channel fetch fails
    ));
    const result = await getOAuthProvider('youtube').exchangeCode({ code: 'code', redirectUri: 'https://r.example.com' });
    expect(result.externalAccountId).toBeNull();
    expect(result.externalAccountLabel).toBeNull();
  });

  it('handles channel with no items', async () => {
    vi.stubGlobal('fetch', mockFetch(
      { ok: true, body: tokenBody },
      { ok: true, body: { items: [] } }
    ));
    const result = await getOAuthProvider('youtube').exchangeCode({ code: 'code', redirectUri: 'https://r.example.com' });
    expect(result.externalAccountId).toBeNull();
  });
});

describe('youtubeProvider.refreshAccessToken()', () => {
  beforeEach(() => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'yt-id';
    process.env.YOUTUBE_OAUTH_CLIENT_SECRET = 'yt-secret';
  });
  afterEach(() => vi.restoreAllMocks());

  it('returns new access token on success', async () => {
    vi.stubGlobal('fetch', mockFetch({
      ok: true,
      body: { access_token: 'new-yt-access', expires_in: 3600 },
    }));
    const result = await getOAuthProvider('youtube').refreshAccessToken('old-refresh');
    expect(result.accessToken).toBe('new-yt-access');
    expect(result.expiresAt).toBeTruthy();
    expect(result.refreshToken).toBeNull();
  });

  it('propagates rotated refresh token if provided', async () => {
    vi.stubGlobal('fetch', mockFetch({
      ok: true,
      body: { access_token: 'new-at', expires_in: 3600, refresh_token: 'new-rt' },
    }));
    const result = await getOAuthProvider('youtube').refreshAccessToken('old');
    expect(result.refreshToken).toBe('new-rt');
  });

  it('throws on refresh failure', async () => {
    vi.stubGlobal('fetch', mockFetch({ ok: false, status: 401, body: { error: 'invalid_token' } }));
    await expect(getOAuthProvider('youtube').refreshAccessToken('bad')).rejects.toThrow('YouTube token refresh failed');
  });
});

// ─── TikTok ──────────────────────────────────────────────────────────────────

// Covers the catch{return null} branch in TikTok's fetchDisplayName (line 101)
describe('tiktokProvider: fetchDisplayName network exception', () => {
  const tokenBody = {
    access_token: 'tt-access', refresh_token: 'tt-refresh', expires_in: 86400,
    open_id: 'oid', scope: 'video.publish',
  };
  beforeEach(() => {
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'tt-key';
    process.env.TIKTOK_OAUTH_CLIENT_SECRET = 'tt-secret';
  });
  afterEach(() => vi.restoreAllMocks());

  it('returns null label when fetchDisplayName throws a network error', async () => {
    let call = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      call++;
      if (call === 1) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(tokenBody), text: () => Promise.resolve(''), headers: { get: () => null } });
      return Promise.reject(new Error('Network fail'));
    }));
    const result = await getOAuthProvider('tiktok').exchangeCode({ code: 'c', redirectUri: 'https://r.example.com' });
    expect(result.externalAccountLabel).toBeNull();
  });
});

describe('tiktokProvider.exchangeCode()', () => {
  const tokenBody = {
    access_token: 'tt-access',
    refresh_token: 'tt-refresh',
    expires_in: 86400,
    open_id: 'open-id-123',
    scope: 'video.publish',
  };

  beforeEach(() => {
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'tt-key';
    process.env.TIKTOK_OAUTH_CLIENT_SECRET = 'tt-secret';
  });
  afterEach(() => vi.restoreAllMocks());

  it('returns tokens on success', async () => {
    const userBody = { data: { user: { display_name: 'TikToker' } } };
    vi.stubGlobal('fetch', mockFetch({ ok: true, body: tokenBody }, { ok: true, body: userBody }));
    const result = await getOAuthProvider('tiktok').exchangeCode({ code: 'code', redirectUri: 'https://r.example.com' });
    expect(result.accessToken).toBe('tt-access');
    expect(result.refreshToken).toBe('tt-refresh');
    expect(result.externalAccountId).toBe('open-id-123');
    expect(result.externalAccountLabel).toBe('TikToker');
  });

  it('throws when token exchange fails (non-ok HTTP)', async () => {
    vi.stubGlobal('fetch', mockFetch({ ok: false, status: 400, body: { error: 'bad_code' } }));
    await expect(
      getOAuthProvider('tiktok').exchangeCode({ code: 'bad', redirectUri: 'https://r.example.com' })
    ).rejects.toThrow('TikTok token exchange failed');
  });

  it('throws when response body contains error field', async () => {
    vi.stubGlobal('fetch', mockFetch({ ok: true, body: { error: 'invalid_grant', error_description: 'desc' } }));
    await expect(
      getOAuthProvider('tiktok').exchangeCode({ code: 'code', redirectUri: 'https://r.example.com' })
    ).rejects.toThrow('TikTok token exchange failed');
  });

  it('returns null label when display_name fetch fails', async () => {
    vi.stubGlobal('fetch', mockFetch(
      { ok: true, body: tokenBody },
      { ok: false, status: 401, body: {} }
    ));
    const result = await getOAuthProvider('tiktok').exchangeCode({ code: 'code', redirectUri: 'https://r.example.com' });
    expect(result.externalAccountLabel).toBeNull();
  });

  it('handles missing expires_in gracefully (null expiresAt)', async () => {
    vi.stubGlobal('fetch', mockFetch(
      { ok: true, body: { ...tokenBody, expires_in: undefined } },
      { ok: true, body: { data: { user: { display_name: 'T' } } } }
    ));
    const result = await getOAuthProvider('tiktok').exchangeCode({ code: 'c', redirectUri: 'https://r.example.com' });
    expect(result.expiresAt).toBeNull();
  });
});

describe('tiktokProvider.refreshAccessToken()', () => {
  beforeEach(() => {
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'tt-key';
    process.env.TIKTOK_OAUTH_CLIENT_SECRET = 'tt-secret';
  });
  afterEach(() => vi.restoreAllMocks());

  it('returns new access token', async () => {
    vi.stubGlobal('fetch', mockFetch({ ok: true, body: { access_token: 'new-tt', expires_in: 86400 } }));
    const result = await getOAuthProvider('tiktok').refreshAccessToken('old-rt');
    expect(result.accessToken).toBe('new-tt');
    expect(result.expiresAt).toBeTruthy();
  });

  it('propagates rotated refresh token', async () => {
    vi.stubGlobal('fetch', mockFetch({ ok: true, body: { access_token: 'at', expires_in: 86400, refresh_token: 'new-rt' } }));
    const result = await getOAuthProvider('tiktok').refreshAccessToken('old');
    expect(result.refreshToken).toBe('new-rt');
  });

  it('throws on error body', async () => {
    vi.stubGlobal('fetch', mockFetch({ ok: true, body: { error: 'expired_token' } }));
    await expect(getOAuthProvider('tiktok').refreshAccessToken('bad')).rejects.toThrow('TikTok token refresh failed');
  });

  it('throws on HTTP error', async () => {
    vi.stubGlobal('fetch', mockFetch({ ok: false, status: 401, body: {} }));
    await expect(getOAuthProvider('tiktok').refreshAccessToken('bad')).rejects.toThrow('TikTok token refresh failed');
  });
});

// ─── Facebook ────────────────────────────────────────────────────────────────

describe('facebookProvider.exchangeCode()', () => {
  const shortLivedBody = { access_token: 'sl-token' };
  const longLivedBody = { access_token: 'll-token' };
  const pagesBody = { data: [{ id: 'page-123', name: 'My Page', access_token: 'page-token' }] };

  beforeEach(() => {
    process.env.FACEBOOK_APP_ID = 'fb-id';
    process.env.FACEBOOK_APP_SECRET = 'fb-secret';
  });
  afterEach(() => vi.restoreAllMocks());

  it('returns page token on success', async () => {
    vi.stubGlobal('fetch', mockFetch(
      { ok: true, body: shortLivedBody },  // short-lived exchange
      { ok: true, body: longLivedBody },   // long-lived exchange
      { ok: true, body: pagesBody },       // /me/accounts
    ));
    const result = await getOAuthProvider('facebook').exchangeCode({ code: 'code', redirectUri: 'https://r.example.com' });
    expect(result.accessToken).toBe('page-token');
    expect(result.refreshToken).toBe('ll-token');
    expect(result.externalAccountId).toBe('page-123');
    expect(result.externalAccountLabel).toBe('My Page');
    expect(result.expiresAt).toBeNull();
  });

  it('throws when short-lived exchange returns no access_token', async () => {
    vi.stubGlobal('fetch', mockFetch({ ok: true, body: {} }));
    await expect(
      getOAuthProvider('facebook').exchangeCode({ code: 'code', redirectUri: 'https://r.example.com' })
    ).rejects.toThrow('no access_token');
  });

  it('throws when long-lived exchange returns no access_token', async () => {
    vi.stubGlobal('fetch', mockFetch(
      { ok: true, body: shortLivedBody },
      { ok: true, body: {} }
    ));
    await expect(
      getOAuthProvider('facebook').exchangeCode({ code: 'code', redirectUri: 'https://r.example.com' })
    ).rejects.toThrow('long-lived token exchange failed');
  });

  it('throws when the account has no Pages', async () => {
    vi.stubGlobal('fetch', mockFetch(
      { ok: true, body: shortLivedBody },
      { ok: true, body: longLivedBody },
      { ok: true, body: { data: [] } }
    ));
    await expect(
      getOAuthProvider('facebook').exchangeCode({ code: 'code', redirectUri: 'https://r.example.com' })
    ).rejects.toThrow('no Pages');
  });

  it('throws when Graph API call fails (non-ok HTTP)', async () => {
    vi.stubGlobal('fetch', mockFetch({ ok: false, status: 400, body: { error: { message: 'bad' } } }));
    await expect(
      getOAuthProvider('facebook').exchangeCode({ code: 'code', redirectUri: 'https://r.example.com' })
    ).rejects.toThrow('Facebook Graph API call failed');
  });

  it('uses page id as label when page name is missing', async () => {
    const pagesBodyNoName = { data: [{ id: 'page-456', access_token: 'pt' }] };
    vi.stubGlobal('fetch', mockFetch(
      { ok: true, body: shortLivedBody },
      { ok: true, body: longLivedBody },
      { ok: true, body: pagesBodyNoName }
    ));
    const result = await getOAuthProvider('facebook').exchangeCode({ code: 'code', redirectUri: 'https://r.example.com' });
    expect(result.externalAccountLabel).toBe('page-456');
  });
});

describe('facebookProvider.refreshAccessToken()', () => {
  const pagesBody = { data: [{ id: 'p1', name: 'Page', access_token: 'new-page-token' }] };

  beforeEach(() => {
    process.env.FACEBOOK_APP_ID = 'fb-id';
    process.env.FACEBOOK_APP_SECRET = 'fb-secret';
  });
  afterEach(() => vi.restoreAllMocks());

  it('re-derives page token from long-lived user token', async () => {
    vi.stubGlobal('fetch', mockFetch({ ok: true, body: pagesBody }));
    const result = await getOAuthProvider('facebook').refreshAccessToken('ll-user-token');
    expect(result.accessToken).toBe('new-page-token');
    expect(result.expiresAt).toBeNull();
    expect(result.refreshToken).toBeNull();
  });

  it('throws when no pages found on refresh', async () => {
    vi.stubGlobal('fetch', mockFetch({ ok: true, body: { data: [] } }));
    await expect(getOAuthProvider('facebook').refreshAccessToken('expired-user-token')).rejects.toThrow('re-derivation failed');
  });

  it('throws when Graph API fails during refresh', async () => {
    vi.stubGlobal('fetch', mockFetch({ ok: false, status: 401, body: { error: { message: 'expired' } } }));
    await expect(getOAuthProvider('facebook').refreshAccessToken('bad')).rejects.toThrow('Facebook Graph API call failed');
  });
});

// Covers the catch{return null} branch in fetchOwnChannel (line 105)
describe('youtubeProvider: fetchOwnChannel network exception', () => {
  beforeEach(() => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'yt-id';
    process.env.YOUTUBE_OAUTH_CLIENT_SECRET = 'yt-secret';
  });
  afterEach(() => vi.restoreAllMocks());

  it('gracefully returns null account info when channel fetch throws', async () => {
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({
          ok: true, status: 200,
          json: () => Promise.resolve({
            access_token: 'at', refresh_token: 'rt', expires_in: 3600,
            scope: 'https://www.googleapis.com/auth/youtube.upload',
          }),
          text: () => Promise.resolve(''),
          headers: { get: () => null },
        });
      }
      // Second call (channel fetch) throws a network error
      return Promise.reject(new Error('Network error'));
    }));
    const result = await getOAuthProvider('youtube').exchangeCode({ code: 'c', redirectUri: 'https://r.example.com' });
    expect(result.externalAccountId).toBeNull();
    expect(result.externalAccountLabel).toBeNull();
  });
});

// ─── Canva ───────────────────────────────────────────────────────────────────

// Covers the catch{return null} branch in Canva's fetchDisplayName (line 104)
describe('canvaProvider: fetchDisplayName network exception', () => {
  const tokenBody = { access_token: 'cv-at', refresh_token: 'cv-rt', expires_in: 3600, scope: 'design:content:write design:meta:read profile:read' };
  beforeEach(() => {
    process.env.CANVA_CLIENT_ID = 'cv-id';
    process.env.CANVA_CLIENT_SECRET = 'cv-secret';
  });
  afterEach(() => vi.restoreAllMocks());

  it('returns null label when profile fetch throws a network error', async () => {
    let call = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      call++;
      if (call === 1) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(tokenBody), text: () => Promise.resolve(''), headers: { get: () => null } });
      return Promise.reject(new Error('Network fail'));
    }));
    const result = await getOAuthProvider('canva').exchangeCode({ code: 'c', redirectUri: 'https://r.example.com' });
    expect(result.externalAccountLabel).toBeNull();
  });
});

describe('canvaProvider.exchangeCode()', () => {
  const tokenBody = { access_token: 'cv-access', refresh_token: 'cv-refresh', expires_in: 3600, scope: 'design:content:write design:meta:read profile:read' };
  const profileBody = { display_name: 'Canva User' };

  beforeEach(() => {
    process.env.CANVA_CLIENT_ID = 'cv-id';
    process.env.CANVA_CLIENT_SECRET = 'cv-secret';
  });
  afterEach(() => vi.restoreAllMocks());

  it('returns tokens on success', async () => {
    vi.stubGlobal('fetch', mockFetch(
      { ok: true, body: tokenBody },
      { ok: true, body: profileBody }
    ));
    const result = await getOAuthProvider('canva').exchangeCode({ code: 'code', redirectUri: 'https://r.example.com', codeVerifier: 'verifier' });
    expect(result.accessToken).toBe('cv-access');
    expect(result.refreshToken).toBe('cv-refresh');
    expect(result.externalAccountLabel).toBe('Canva User');
    expect(result.externalAccountId).toBeNull(); // Canva doesn't expose stable user id
    expect(result.expiresAt).toBeTruthy();
  });

  it('throws when token exchange fails', async () => {
    vi.stubGlobal('fetch', mockFetch({ ok: false, status: 400, body: 'error text' }));
    await expect(
      getOAuthProvider('canva').exchangeCode({ code: 'bad', redirectUri: 'https://r.example.com' })
    ).rejects.toThrow('Canva token exchange failed');
  });

  it('returns null label when profile fetch fails', async () => {
    vi.stubGlobal('fetch', mockFetch(
      { ok: true, body: tokenBody },
      { ok: false, status: 403, body: {} }
    ));
    const result = await getOAuthProvider('canva').exchangeCode({ code: 'code', redirectUri: 'https://r.example.com' });
    expect(result.externalAccountLabel).toBeNull();
  });

  it('handles missing display_name in profile body', async () => {
    vi.stubGlobal('fetch', mockFetch(
      { ok: true, body: tokenBody },
      { ok: true, body: {} }
    ));
    const result = await getOAuthProvider('canva').exchangeCode({ code: 'code', redirectUri: 'https://r.example.com' });
    expect(result.externalAccountLabel).toBeNull();
  });

  it('throws when CANVA_CLIENT_SECRET is missing', async () => {
    delete process.env.CANVA_CLIENT_SECRET;
    await expect(
      getOAuthProvider('canva').exchangeCode({ code: 'code', redirectUri: 'https://r.example.com' })
    ).rejects.toThrow('CANVA_CLIENT_SECRET');
  });
});

describe('canvaProvider.refreshAccessToken()', () => {
  beforeEach(() => {
    process.env.CANVA_CLIENT_ID = 'cv-id';
    process.env.CANVA_CLIENT_SECRET = 'cv-secret';
  });
  afterEach(() => vi.restoreAllMocks());

  it('returns new access token', async () => {
    vi.stubGlobal('fetch', mockFetch({
      ok: true,
      body: { access_token: 'new-cv-at', expires_in: 3600 },
    }));
    const result = await getOAuthProvider('canva').refreshAccessToken('old-rt');
    expect(result.accessToken).toBe('new-cv-at');
    expect(result.expiresAt).toBeTruthy();
  });

  it('propagates rotated refresh token', async () => {
    vi.stubGlobal('fetch', mockFetch({ ok: true, body: { access_token: 'at', expires_in: 3600, refresh_token: 'new-rt' } }));
    const result = await getOAuthProvider('canva').refreshAccessToken('old');
    expect(result.refreshToken).toBe('new-rt');
  });

  it('returns null refreshToken when not provided', async () => {
    vi.stubGlobal('fetch', mockFetch({ ok: true, body: { access_token: 'at', expires_in: 3600 } }));
    const result = await getOAuthProvider('canva').refreshAccessToken('old');
    expect(result.refreshToken).toBeNull();
  });

  it('throws on HTTP error', async () => {
    vi.stubGlobal('fetch', mockFetch({ ok: false, status: 401, body: 'Unauthorized' }));
    await expect(getOAuthProvider('canva').refreshAccessToken('bad')).rejects.toThrow('Canva token refresh failed');
  });
});
