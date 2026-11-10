/**
 * Tests for exchangeCode() and refreshAccessToken() across all four OAuth
 * providers. Network calls are mocked via vi.stubGlobal('fetch', ...).
 * Env vars are set/cleared per-test so requireEnv() behaves predictably.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── helpers ───────────────────────────────────────────────────────────────────

function mockOk(body: unknown) {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  };
}

function mockFail(status: number, body: unknown = {}) {
  return {
    ok: false,
    status,
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(JSON.stringify(body)),
  };
}

// ── YouTube provider ──────────────────────────────────────────────────────────

describe('youtubeProvider.exchangeCode()', () => {
  beforeEach(() => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'yt-client-id';
    process.env.YOUTUBE_OAUTH_CLIENT_SECRET = 'yt-secret';
  });

  afterEach(() => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    delete process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
    vi.unstubAllGlobals();
  });

  it('returns full TokenExchangeResult on success', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockOk({
        access_token: 'yt-at',
        refresh_token: 'yt-rt',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/youtube.upload',
      }))
      .mockResolvedValueOnce(mockOk({
        items: [{ id: 'ch1', snippet: { title: 'My Channel' } }],
      }))
    );
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const result = await youtubeProvider.exchangeCode({
      code: 'authcode',
      redirectUri: 'https://example.com/cb',
    });
    expect(result.accessToken).toBe('yt-at');
    expect(result.refreshToken).toBe('yt-rt');
    expect(result.externalAccountId).toBe('ch1');
    expect(result.externalAccountLabel).toBe('My Channel');
    expect(result.scope).toContain('youtube.upload');
    expect(result.expiresAt).toBeTruthy();
  });

  it('throws when token endpoint returns non-OK', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockFail(400, 'Bad request'))
    );
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    await expect(
      youtubeProvider.exchangeCode({ code: 'bad', redirectUri: 'https://example.com/cb' })
    ).rejects.toThrow('YouTube token exchange failed');
  });

  it('throws when no refresh_token is returned', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockOk({
        access_token: 'yt-at',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/youtube.upload',
        // no refresh_token
      }))
    );
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    await expect(
      youtubeProvider.exchangeCode({ code: 'code', redirectUri: 'https://example.com/cb' })
    ).rejects.toThrow('refresh_token');
  });

  it('gracefully handles channel lookup failure (returns null for account id/label)', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockOk({
        access_token: 'yt-at',
        refresh_token: 'yt-rt',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/youtube.upload',
      }))
      .mockRejectedValueOnce(new Error('channel fetch failed'))
    );
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const result = await youtubeProvider.exchangeCode({
      code: 'code',
      redirectUri: 'https://example.com/cb',
    });
    expect(result.externalAccountId).toBeNull();
    expect(result.externalAccountLabel).toBeNull();
  });

  it('handles channel endpoint returning no items', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockOk({
        access_token: 'yt-at',
        refresh_token: 'yt-rt',
        expires_in: 3600,
        scope: 'upload',
      }))
      .mockResolvedValueOnce(mockOk({ items: [] }))
    );
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const result = await youtubeProvider.exchangeCode({
      code: 'code',
      redirectUri: 'https://example.com/cb',
    });
    expect(result.externalAccountId).toBeNull();
  });
});

describe('youtubeProvider.refreshAccessToken()', () => {
  beforeEach(() => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'yt-client-id';
    process.env.YOUTUBE_OAUTH_CLIENT_SECRET = 'yt-secret';
  });

  afterEach(() => {
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    delete process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
    vi.unstubAllGlobals();
  });

  it('returns new access token and expiry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(mockOk({
      access_token: 'new-yt-at',
      expires_in: 3600,
    })));
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const result = await youtubeProvider.refreshAccessToken('old-rt');
    expect(result.accessToken).toBe('new-yt-at');
    expect(result.expiresAt).toBeTruthy();
    expect(result.refreshToken).toBeNull(); // Google doesn't rotate by default
  });

  it('returns rotated refresh token when Google provides one', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(mockOk({
      access_token: 'new-at',
      expires_in: 3600,
      refresh_token: 'new-rt',
    })));
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const result = await youtubeProvider.refreshAccessToken('old-rt');
    expect(result.refreshToken).toBe('new-rt');
  });

  it('throws on non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(mockFail(401)));
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    await expect(youtubeProvider.refreshAccessToken('bad-rt')).rejects.toThrow(
      'YouTube token refresh failed'
    );
  });
});

// ── TikTok provider ───────────────────────────────────────────────────────────

describe('tiktokProvider.exchangeCode()', () => {
  beforeEach(() => {
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'tt-key';
    process.env.TIKTOK_OAUTH_CLIENT_SECRET = 'tt-secret';
  });

  afterEach(() => {
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    delete process.env.TIKTOK_OAUTH_CLIENT_SECRET;
    vi.unstubAllGlobals();
  });

  it('returns full TokenExchangeResult on success', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockOk({
        access_token: 'tt-at',
        refresh_token: 'tt-rt',
        expires_in: 86400,
        open_id: 'tt-user-id',
        scope: 'video.publish',
      }))
      .mockResolvedValueOnce(mockOk({
        data: { user: { display_name: 'TikTokCreator' } },
      }))
    );
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const result = await tiktokProvider.exchangeCode({
      code: 'tt-code',
      redirectUri: 'https://example.com/cb',
    });
    expect(result.accessToken).toBe('tt-at');
    expect(result.refreshToken).toBe('tt-rt');
    expect(result.externalAccountId).toBe('tt-user-id');
    expect(result.externalAccountLabel).toBe('TikTokCreator');
  });

  it('throws when response body has an error field', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({ error: 'invalid_code', error_description: 'bad code' }),
      })
    );
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    await expect(
      tiktokProvider.exchangeCode({ code: 'bad', redirectUri: 'https://example.com/cb' })
    ).rejects.toThrow('TikTok token exchange failed');
  });

  it('handles missing expires_in (expiresAt is null)', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockOk({
        access_token: 'tt-at',
        // no expires_in
      }))
      .mockResolvedValueOnce(mockOk({ data: {} }))
    );
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const result = await tiktokProvider.exchangeCode({
      code: 'code',
      redirectUri: 'https://example.com/cb',
    });
    expect(result.expiresAt).toBeNull();
  });

  it('handles display-name lookup failure gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockOk({
        access_token: 'tt-at',
        refresh_token: 'tt-rt',
        expires_in: 3600,
        open_id: 'uid',
        scope: 'video.publish',
      }))
      .mockRejectedValueOnce(new Error('profile error'))
    );
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const result = await tiktokProvider.exchangeCode({
      code: 'code',
      redirectUri: 'https://example.com/cb',
    });
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
    vi.unstubAllGlobals();
  });

  it('returns new access token', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(mockOk({
      access_token: 'new-tt-at',
      expires_in: 86400,
    })));
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const result = await tiktokProvider.refreshAccessToken('old-rt');
    expect(result.accessToken).toBe('new-tt-at');
  });

  it('throws on error body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: vi.fn().mockResolvedValue({ error: 'token_expired' }),
    }));
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    await expect(tiktokProvider.refreshAccessToken('rt')).rejects.toThrow(
      'TikTok token refresh failed'
    );
  });
});

// ── Facebook provider ─────────────────────────────────────────────────────────

describe('facebookProvider.exchangeCode()', () => {
  beforeEach(() => {
    process.env.FACEBOOK_APP_ID = 'fb-app-id';
    process.env.FACEBOOK_APP_SECRET = 'fb-secret';
  });

  afterEach(() => {
    delete process.env.FACEBOOK_APP_ID;
    delete process.env.FACEBOOK_APP_SECRET;
    vi.unstubAllGlobals();
  });

  it('returns full TokenExchangeResult with page token on success', async () => {
    vi.stubGlobal('fetch', vi.fn()
      // short-lived token exchange
      .mockResolvedValueOnce(mockOk({ access_token: 'short-at' }))
      // long-lived token exchange
      .mockResolvedValueOnce(mockOk({ access_token: 'long-at' }))
      // /me/accounts
      .mockResolvedValueOnce(mockOk({
        data: [{ id: 'page1', name: 'My Page', access_token: 'page-at' }],
      }))
    );
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    const result = await facebookProvider.exchangeCode({
      code: 'fb-code',
      redirectUri: 'https://example.com/cb',
    });
    expect(result.accessToken).toBe('page-at');
    expect(result.refreshToken).toBe('long-at');
    expect(result.externalAccountId).toBe('page1');
    expect(result.externalAccountLabel).toBe('My Page');
    expect(result.expiresAt).toBeNull();
  });

  it('throws when short-lived token exchange returns no access_token', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockOk({})) // no access_token
    );
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    await expect(
      facebookProvider.exchangeCode({ code: 'bad', redirectUri: 'https://example.com/cb' })
    ).rejects.toThrow('no access_token');
  });

  it('throws when long-lived token exchange returns no access_token', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockOk({ access_token: 'short-at' }))
      .mockResolvedValueOnce(mockOk({})) // no access_token
    );
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    await expect(
      facebookProvider.exchangeCode({ code: 'code', redirectUri: 'https://example.com/cb' })
    ).rejects.toThrow('long-lived token exchange failed');
  });

  it('throws when account has no Pages', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockOk({ access_token: 'short-at' }))
      .mockResolvedValueOnce(mockOk({ access_token: 'long-at' }))
      .mockResolvedValueOnce(mockOk({ data: [] })) // no pages
    );
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    await expect(
      facebookProvider.exchangeCode({ code: 'code', redirectUri: 'https://example.com/cb' })
    ).rejects.toThrow('no Pages');
  });

  it('throws when getJson receives a Graph API error response', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockFail(400, { error: { message: 'Invalid code' } }))
    );
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    await expect(
      facebookProvider.exchangeCode({ code: 'bad', redirectUri: 'https://example.com/cb' })
    ).rejects.toThrow('Facebook Graph API call failed');
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
    vi.unstubAllGlobals();
  });

  it('returns fresh page access token from stored long-lived user token', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockOk({
        data: [{ id: 'page1', name: 'My Page', access_token: 'fresh-page-at' }],
      }))
    );
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    const result = await facebookProvider.refreshAccessToken('long-lived-user-token');
    expect(result.accessToken).toBe('fresh-page-at');
    expect(result.expiresAt).toBeNull();
    expect(result.refreshToken).toBeNull();
  });

  it('throws when long-lived user token is expired (no pages returned)', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockOk({ data: [] }))
    );
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    await expect(facebookProvider.refreshAccessToken('expired-token')).rejects.toThrow(
      're-derivation failed'
    );
  });
});

// ── Canva provider ────────────────────────────────────────────────────────────

describe('canvaProvider.exchangeCode()', () => {
  beforeEach(() => {
    process.env.CANVA_CLIENT_ID = 'canva-id';
    process.env.CANVA_CLIENT_SECRET = 'canva-secret';
  });

  afterEach(() => {
    delete process.env.CANVA_CLIENT_ID;
    delete process.env.CANVA_CLIENT_SECRET;
    vi.unstubAllGlobals();
  });

  it('returns full TokenExchangeResult on success', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockOk({
        access_token: 'cv-at',
        refresh_token: 'cv-rt',
        expires_in: 1800,
        scope: 'design:content:write',
      }))
      .mockResolvedValueOnce(mockOk({ display_name: 'CanvaUser' }))
    );
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const result = await canvaProvider.exchangeCode({
      code: 'cv-code',
      redirectUri: 'https://example.com/cb',
      codeVerifier: 'my-verifier',
    });
    expect(result.accessToken).toBe('cv-at');
    expect(result.refreshToken).toBe('cv-rt');
    expect(result.externalAccountId).toBeNull(); // Canva Connect doesn't expose stable user id
    expect(result.externalAccountLabel).toBe('CanvaUser');
  });

  it('throws when token endpoint returns non-OK', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockFail(400, 'Bad request'))
    );
    const { canvaProvider } = await import('@/lib/oauth/canva');
    await expect(
      canvaProvider.exchangeCode({ code: 'bad', redirectUri: 'https://example.com/cb' })
    ).rejects.toThrow('Canva token exchange failed');
  });

  it('handles display-name lookup failure gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockOk({
        access_token: 'cv-at',
        refresh_token: 'cv-rt',
        expires_in: 1800,
        scope: 'design:content:write',
      }))
      .mockRejectedValueOnce(new Error('profile error'))
    );
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const result = await canvaProvider.exchangeCode({
      code: 'code',
      redirectUri: 'https://example.com/cb',
    });
    expect(result.externalAccountLabel).toBeNull();
  });

  it('handles display-name non-OK response gracefully', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockOk({
        access_token: 'cv-at',
        refresh_token: 'cv-rt',
        expires_in: 1800,
        scope: 'design:content:write',
      }))
      .mockResolvedValueOnce(mockFail(403))
    );
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const result = await canvaProvider.exchangeCode({
      code: 'code',
      redirectUri: 'https://example.com/cb',
    });
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
    vi.unstubAllGlobals();
  });

  it('returns new access token and expiry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(mockOk({
      access_token: 'new-cv-at',
      expires_in: 1800,
      refresh_token: 'new-cv-rt',
    })));
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const result = await canvaProvider.refreshAccessToken('old-rt');
    expect(result.accessToken).toBe('new-cv-at');
    expect(result.refreshToken).toBe('new-cv-rt');
    expect(result.expiresAt).toBeTruthy();
  });

  it('returns null refreshToken when provider does not rotate it', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(mockOk({
      access_token: 'new-cv-at',
      expires_in: 1800,
      // no refresh_token
    })));
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const result = await canvaProvider.refreshAccessToken('old-rt');
    expect(result.refreshToken).toBeNull();
  });

  it('throws on non-OK response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(mockFail(401)));
    const { canvaProvider } = await import('@/lib/oauth/canva');
    await expect(canvaProvider.refreshAccessToken('bad-rt')).rejects.toThrow(
      'Canva token refresh failed'
    );
  });
});
