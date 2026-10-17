import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { tiktokProvider } from '@/lib/oauth/tiktok';

const ENV = {
  TIKTOK_OAUTH_CLIENT_KEY: 'test-client-key',
  TIKTOK_OAUTH_CLIENT_SECRET: 'test-client-secret',
};

function mockOk(body: object) {
  return { ok: true, status: 200, json: async () => body } as Response;
}

function mockErr(body: object, status = 400) {
  return { ok: false, status, json: async () => body } as Response;
}

beforeEach(() => {
  for (const [k, v] of Object.entries(ENV)) vi.stubEnv(k, v);
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('tiktokProvider.requiresPkce', () => {
  it('is false', () => {
    expect(tiktokProvider.requiresPkce).toBe(false);
  });
});

describe('tiktokProvider.authorizationUrl()', () => {
  it('throws when TIKTOK_OAUTH_CLIENT_KEY is missing', () => {
    vi.unstubAllEnvs();
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    expect(() =>
      tiktokProvider.authorizationUrl({ state: 's', redirectUri: 'http://r/' })
    ).toThrow('TIKTOK_OAUTH_CLIENT_KEY');
  });

  it('builds a TikTok authorization URL', () => {
    const url = tiktokProvider.authorizationUrl({ state: 's', redirectUri: 'http://r/' });
    expect(url).toContain('tiktok.com');
  });

  it('includes client_key', () => {
    const url = tiktokProvider.authorizationUrl({ state: 's', redirectUri: 'http://r/' });
    expect(url).toContain('client_key=test-client-key');
  });

  it('includes state', () => {
    const url = tiktokProvider.authorizationUrl({ state: 'csrf_xyz', redirectUri: 'http://r/' });
    expect(url).toContain('state=csrf_xyz');
  });

  it('includes video.publish scope', () => {
    const url = tiktokProvider.authorizationUrl({ state: 's', redirectUri: 'http://r/' });
    expect(url).toContain('scope=video.publish');
  });

  it('sets response_type=code', () => {
    const url = tiktokProvider.authorizationUrl({ state: 's', redirectUri: 'http://r/' });
    expect(url).toContain('response_type=code');
  });
});

describe('tiktokProvider.exchangeCode()', () => {
  it('throws when TIKTOK_OAUTH_CLIENT_KEY is missing', async () => {
    vi.unstubAllEnvs();
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    await expect(
      tiktokProvider.exchangeCode({ code: 'c', redirectUri: 'http://r/' })
    ).rejects.toThrow('TIKTOK_OAUTH_CLIENT_KEY');
  });

  it('throws when token response has an error field', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      mockOk({ error: 'invalid_grant', error_description: 'Bad code' })
    );
    vi.stubGlobal('fetch', mockFetch);
    await expect(
      tiktokProvider.exchangeCode({ code: 'bad', redirectUri: 'http://r/' })
    ).rejects.toThrow('TikTok token exchange failed');
  });

  it('throws when token response is not ok', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(mockErr({ error: 'fail' }, 400));
    vi.stubGlobal('fetch', mockFetch);
    await expect(
      tiktokProvider.exchangeCode({ code: 'c', redirectUri: 'http://r/' })
    ).rejects.toThrow('TikTok token exchange failed');
  });

  it('returns token result with display name on happy path', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        mockOk({
          access_token: 'at',
          refresh_token: 'rt',
          expires_in: 86400,
          open_id: 'user123',
          scope: 'video.publish',
        })
      )
      .mockResolvedValueOnce(
        mockOk({ data: { user: { display_name: 'Cool Creator' } } })
      );
    vi.stubGlobal('fetch', mockFetch);

    const result = await tiktokProvider.exchangeCode({ code: 'code', redirectUri: 'http://r/' });
    expect(result.accessToken).toBe('at');
    expect(result.refreshToken).toBe('rt');
    expect(result.externalAccountId).toBe('user123');
    expect(result.externalAccountLabel).toBe('Cool Creator');
    expect(result.expiresAt).toBeTruthy();
    expect(result.scope).toBe('video.publish');
  });

  it('returns null label when display name fetch fails', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        mockOk({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, open_id: 'u1', scope: 'v' })
      )
      .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) } as Response);
    vi.stubGlobal('fetch', mockFetch);

    const result = await tiktokProvider.exchangeCode({ code: 'c', redirectUri: 'http://r/' });
    expect(result.externalAccountLabel).toBeNull();
  });

  it('returns null label when display name fetch throws', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        mockOk({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, open_id: 'u1', scope: 'v' })
      )
      .mockRejectedValueOnce(new Error('Network error'));
    vi.stubGlobal('fetch', mockFetch);

    const result = await tiktokProvider.exchangeCode({ code: 'c', redirectUri: 'http://r/' });
    expect(result.externalAccountLabel).toBeNull();
  });

  it('returns null expiresAt when expires_in is absent', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        mockOk({ access_token: 'at', refresh_token: 'rt', open_id: 'u1', scope: 'v' })
      )
      .mockResolvedValueOnce(mockOk({ data: { user: { display_name: null } } }));
    vi.stubGlobal('fetch', mockFetch);

    const result = await tiktokProvider.exchangeCode({ code: 'c', redirectUri: 'http://r/' });
    expect(result.expiresAt).toBeNull();
  });

  it('returns null refresh_token when absent in response', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        mockOk({ access_token: 'at', expires_in: 3600, open_id: 'u1', scope: 'v' })
      )
      .mockResolvedValueOnce(mockOk({}));
    vi.stubGlobal('fetch', mockFetch);

    const result = await tiktokProvider.exchangeCode({ code: 'c', redirectUri: 'http://r/' });
    expect(result.refreshToken).toBeNull();
  });

  it('returns null externalAccountId when open_id is absent', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        mockOk({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, scope: 'v' })
      )
      .mockResolvedValueOnce(mockOk({}));
    vi.stubGlobal('fetch', mockFetch);

    const result = await tiktokProvider.exchangeCode({ code: 'c', redirectUri: 'http://r/' });
    expect(result.externalAccountId).toBeNull();
  });

  it('falls back to PUBLISH_SCOPE when scope is absent from response', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        mockOk({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, open_id: 'u1' })
      )
      .mockResolvedValueOnce(mockOk({}));
    vi.stubGlobal('fetch', mockFetch);

    const result = await tiktokProvider.exchangeCode({ code: 'c', redirectUri: 'http://r/' });
    expect(result.scope).toBe('video.publish');
  });
});

describe('tiktokProvider.refreshAccessToken()', () => {
  it('throws when TIKTOK_OAUTH_CLIENT_KEY is missing', async () => {
    vi.unstubAllEnvs();
    delete process.env.TIKTOK_OAUTH_CLIENT_KEY;
    await expect(tiktokProvider.refreshAccessToken('rt')).rejects.toThrow('TIKTOK_OAUTH_CLIENT_KEY');
  });

  it('throws when response is not ok', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(mockErr({ error: 'fail' }, 401));
    vi.stubGlobal('fetch', mockFetch);
    await expect(tiktokProvider.refreshAccessToken('bad-rt')).rejects.toThrow('TikTok token refresh failed');
  });

  it('throws when response has error field', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(mockOk({ error: 'token_expired' }));
    vi.stubGlobal('fetch', mockFetch);
    await expect(tiktokProvider.refreshAccessToken('rt')).rejects.toThrow('TikTok token refresh failed');
  });

  it('returns new access token on success', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      mockOk({ access_token: 'new-at', expires_in: 3600 })
    );
    vi.stubGlobal('fetch', mockFetch);

    const result = await tiktokProvider.refreshAccessToken('old-rt');
    expect(result.accessToken).toBe('new-at');
    expect(result.expiresAt).toBeTruthy();
    expect(result.refreshToken).toBeNull();
  });

  it('returns rotated refresh token when provided', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      mockOk({ access_token: 'new-at', refresh_token: 'new-rt', expires_in: 3600 })
    );
    vi.stubGlobal('fetch', mockFetch);

    const result = await tiktokProvider.refreshAccessToken('old-rt');
    expect(result.refreshToken).toBe('new-rt');
  });

  it('returns null expiresAt when expires_in is absent', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      mockOk({ access_token: 'at' })
    );
    vi.stubGlobal('fetch', mockFetch);

    const result = await tiktokProvider.refreshAccessToken('rt');
    expect(result.expiresAt).toBeNull();
  });

  it('posts grant_type=refresh_token and the correct refresh token', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      mockOk({ access_token: 'at', expires_in: 3600 })
    );
    vi.stubGlobal('fetch', mockFetch);

    await tiktokProvider.refreshAccessToken('my-rt');
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain('tiktokapis.com');
    const body = new URLSearchParams(init.body as string);
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('my-rt');
  });
});
