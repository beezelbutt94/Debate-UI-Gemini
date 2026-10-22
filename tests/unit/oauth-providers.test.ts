import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getOAuthProvider } from '@/lib/oauth/index';

// Helper to build a minimal fetch stub that returns JSON
function mockFetch(body: unknown, status = 200) {
  const text = JSON.stringify(body);
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(text),
  } as unknown as Response);
}

// ─── YouTube provider ────────────────────────────────────────────────────────

describe('youtube provider — exchangeCode', () => {
  beforeEach(() => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'yt-client-id';
    process.env.YOUTUBE_OAUTH_CLIENT_SECRET = 'yt-client-secret';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    delete process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
  });

  it('returns a TokenExchangeResult on success', async () => {
    const tokenBody = {
      access_token: 'ya29.access',
      refresh_token: 'refresh-yt',
      expires_in: 3600,
      scope: 'https://www.googleapis.com/auth/youtube.upload',
    };
    const channelBody = { items: [{ id: 'UC123', snippet: { title: 'My Channel' } }] };

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(tokenBody),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(channelBody),
        } as unknown as Response)
    );

    const result = await getOAuthProvider('youtube').exchangeCode({
      code: 'auth-code',
      redirectUri: 'https://example.com/cb',
    });

    expect(result.accessToken).toBe('ya29.access');
    expect(result.refreshToken).toBe('refresh-yt');
    expect(result.externalAccountId).toBe('UC123');
    expect(result.externalAccountLabel).toBe('My Channel');
    expect(result.expiresAt).toBeDefined();
  });

  it('throws when refresh_token is missing (Google re-consent issue)', async () => {
    const tokenBody = { access_token: 'ya29.access', expires_in: 3600 };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(tokenBody),
      } as unknown as Response)
    );

    await expect(
      getOAuthProvider('youtube').exchangeCode({ code: 'code', redirectUri: 'https://example.com/cb' })
    ).rejects.toThrow('refresh_token');
  });

  it('throws when token endpoint returns an error status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('invalid_grant'),
      } as unknown as Response)
    );

    await expect(
      getOAuthProvider('youtube').exchangeCode({ code: 'bad-code', redirectUri: 'https://example.com/cb' })
    ).rejects.toThrow('YouTube token exchange failed');
  });

  it('refreshAccessToken returns a new access token', async () => {
    const body = { access_token: 'ya29.new', expires_in: 3600 };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(body),
      } as unknown as Response)
    );

    const result = await getOAuthProvider('youtube').refreshAccessToken('old-refresh');
    expect(result.accessToken).toBe('ya29.new');
    expect(result.expiresAt).toBeDefined();
    expect(result.refreshToken).toBeNull();
  });

  it('refreshAccessToken propagates rotated refresh token when present', async () => {
    const body = { access_token: 'ya29.new', expires_in: 3600, refresh_token: 'rotated' };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(body),
      } as unknown as Response)
    );

    const result = await getOAuthProvider('youtube').refreshAccessToken('old-refresh');
    expect(result.refreshToken).toBe('rotated');
  });

  it('refreshAccessToken throws on error response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('invalid_grant'),
      } as unknown as Response)
    );

    await expect(getOAuthProvider('youtube').refreshAccessToken('bad-token')).rejects.toThrow(
      'YouTube token refresh failed'
    );
  });

  it('falls back to null externalAccountLabel when channel fetch fails', async () => {
    const tokenBody = {
      access_token: 'ya29.access',
      refresh_token: 'rt',
      expires_in: 3600,
      scope: 'youtube.upload',
    };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(tokenBody),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          json: () => Promise.resolve({}),
        } as unknown as Response)
    );

    const result = await getOAuthProvider('youtube').exchangeCode({
      code: 'code',
      redirectUri: 'https://example.com/cb',
    });
    expect(result.externalAccountId).toBeNull();
    expect(result.externalAccountLabel).toBeNull();
  });
});

// ─── TikTok provider ──────────────────────────────────────────────────────────

describe('tiktok provider — exchangeCode', () => {
  beforeEach(() => {
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'tt-key';
    process.env.TIKTOK_OAUTH_CLIENT_SECRET = 'tt-secret';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    delete process.env.TIKTOK_OAUTH_CLIENT_SECRET;
  });

  it('returns a TokenExchangeResult on success', async () => {
    const tokenBody = {
      access_token: 'tt-access',
      refresh_token: 'tt-refresh',
      expires_in: 86400,
      open_id: 'tt-user-123',
      scope: 'video.publish',
    };
    const userBody = { data: { user: { display_name: 'TT User' } } };

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(tokenBody),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(userBody),
        } as unknown as Response)
    );

    const result = await getOAuthProvider('tiktok').exchangeCode({
      code: 'tt-code',
      redirectUri: 'https://example.com/cb',
    });

    expect(result.accessToken).toBe('tt-access');
    expect(result.refreshToken).toBe('tt-refresh');
    expect(result.externalAccountId).toBe('tt-user-123');
    expect(result.externalAccountLabel).toBe('TT User');
  });

  it('throws when the response has an error field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ error: 'invalid_code', error_description: 'bad code' }),
      } as unknown as Response)
    );

    await expect(
      getOAuthProvider('tiktok').exchangeCode({ code: 'bad', redirectUri: 'https://example.com/cb' })
    ).rejects.toThrow('TikTok token exchange failed');
  });

  it('handles missing expires_in gracefully (expiresAt = null)', async () => {
    const tokenBody = {
      access_token: 'tt-access',
      refresh_token: 'tt-refresh',
      open_id: 'uid',
      scope: 'video.publish',
    };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(tokenBody),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          json: () => Promise.resolve({}),
        } as unknown as Response)
    );

    const result = await getOAuthProvider('tiktok').exchangeCode({
      code: 'code',
      redirectUri: 'https://example.com/cb',
    });
    expect(result.expiresAt).toBeNull();
  });

  it('refreshAccessToken returns updated tokens', async () => {
    const body = { access_token: 'new-tt', expires_in: 86400, refresh_token: 'new-rt' };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(body),
      } as unknown as Response)
    );

    const result = await getOAuthProvider('tiktok').refreshAccessToken('old-rt');
    expect(result.accessToken).toBe('new-tt');
    expect(result.refreshToken).toBe('new-rt');
  });

  it('refreshAccessToken throws on API error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: 'token_expired' }),
      } as unknown as Response)
    );

    await expect(getOAuthProvider('tiktok').refreshAccessToken('bad')).rejects.toThrow(
      'TikTok token refresh failed'
    );
  });
});

// ─── Facebook provider ────────────────────────────────────────────────────────

describe('facebook provider — exchangeCode', () => {
  beforeEach(() => {
    process.env.FACEBOOK_APP_ID = 'fb-app-id';
    process.env.FACEBOOK_APP_SECRET = 'fb-secret';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.FACEBOOK_APP_ID;
    delete process.env.FACEBOOK_APP_SECRET;
  });

  it('returns a TokenExchangeResult with page access token', async () => {
    const shortLivedBody = { access_token: 'short-lived' };
    const longLivedBody = { access_token: 'long-lived' };
    const pagesBody = {
      data: [{ id: 'page-123', name: 'My Page', access_token: 'page-token' }],
    };

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(shortLivedBody),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(longLivedBody),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(pagesBody),
        } as unknown as Response)
    );

    const result = await getOAuthProvider('facebook').exchangeCode({
      code: 'fb-code',
      redirectUri: 'https://example.com/cb',
    });

    expect(result.accessToken).toBe('page-token');
    expect(result.refreshToken).toBe('long-lived');
    expect(result.externalAccountId).toBe('page-123');
    expect(result.externalAccountLabel).toBe('My Page');
    expect(result.expiresAt).toBeNull();
  });

  it('throws when the account has no Pages', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ access_token: 'short' }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ access_token: 'long' }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ data: [] }),
        } as unknown as Response)
    );

    await expect(
      getOAuthProvider('facebook').exchangeCode({ code: 'code', redirectUri: 'https://example.com/cb' })
    ).rejects.toThrow('no Pages');
  });

  it('throws when short-lived token exchange fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: { message: 'Invalid code' } }),
      } as unknown as Response)
    );

    await expect(
      getOAuthProvider('facebook').exchangeCode({ code: 'bad', redirectUri: 'https://example.com/cb' })
    ).rejects.toThrow();
  });

  it('refreshAccessToken re-derives page token from stored long-lived user token', async () => {
    const pagesBody = {
      data: [{ id: 'page-456', name: 'New Page', access_token: 'fresh-page-token' }],
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(pagesBody),
      } as unknown as Response)
    );

    const result = await getOAuthProvider('facebook').refreshAccessToken('long-lived-user-token');
    expect(result.accessToken).toBe('fresh-page-token');
    expect(result.expiresAt).toBeNull();
    expect(result.refreshToken).toBeNull();
  });

  it('refreshAccessToken throws when stored user token is no longer valid', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: [] }),
      } as unknown as Response)
    );

    await expect(getOAuthProvider('facebook').refreshAccessToken('expired-user-token')).rejects.toThrow(
      'Reconnect Facebook'
    );
  });
});

// ─── Canva provider ───────────────────────────────────────────────────────────

describe('canva provider — exchangeCode', () => {
  beforeEach(() => {
    process.env.CANVA_CLIENT_ID = 'canva-id';
    process.env.CANVA_CLIENT_SECRET = 'canva-secret';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.CANVA_CLIENT_ID;
    delete process.env.CANVA_CLIENT_SECRET;
  });

  it('returns a TokenExchangeResult on success', async () => {
    const tokenBody = {
      access_token: 'canva-access',
      refresh_token: 'canva-refresh',
      expires_in: 1800,
      scope: 'design:content:write',
    };
    const profileBody = { display_name: 'Canvas User' };

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(tokenBody),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(profileBody),
        } as unknown as Response)
    );

    const result = await getOAuthProvider('canva').exchangeCode({
      code: 'canva-code',
      redirectUri: 'https://example.com/cb',
      codeVerifier: 'my-verifier',
    });

    expect(result.accessToken).toBe('canva-access');
    expect(result.refreshToken).toBe('canva-refresh');
    expect(result.externalAccountLabel).toBe('Canvas User');
    expect(result.externalAccountId).toBeNull();
    expect(result.expiresAt).toBeDefined();
  });

  it('throws when token endpoint returns an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('invalid_grant'),
      } as unknown as Response)
    );

    await expect(
      getOAuthProvider('canva').exchangeCode({
        code: 'bad',
        redirectUri: 'https://example.com/cb',
        codeVerifier: 'v',
      })
    ).rejects.toThrow('Canva token exchange failed');
  });

  it('refreshAccessToken returns a new access token', async () => {
    const body = { access_token: 'canva-new', expires_in: 1800 };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(body),
      } as unknown as Response)
    );

    const result = await getOAuthProvider('canva').refreshAccessToken('old-canva-rt');
    expect(result.accessToken).toBe('canva-new');
    expect(result.expiresAt).toBeDefined();
    expect(result.refreshToken).toBeNull();
  });

  it('refreshAccessToken throws on error response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('unauthorized'),
      } as unknown as Response)
    );

    await expect(getOAuthProvider('canva').refreshAccessToken('bad-rt')).rejects.toThrow(
      'Canva token refresh failed'
    );
  });

  it('returns null externalAccountLabel when profile fetch fails', async () => {
    const tokenBody = {
      access_token: 'canva-access',
      refresh_token: 'rt',
      expires_in: 1800,
      scope: 'design:content:write',
    };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(tokenBody),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          json: () => Promise.resolve({}),
        } as unknown as Response)
    );

    const result = await getOAuthProvider('canva').exchangeCode({
      code: 'code',
      redirectUri: 'https://example.com/cb',
      codeVerifier: 'v',
    });
    expect(result.externalAccountLabel).toBeNull();
  });
});
