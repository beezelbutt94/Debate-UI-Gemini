import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { youtubeProvider } from '@/lib/oauth/youtube';

const ENV = {
  YOUTUBE_OAUTH_CLIENT_ID: 'test-client-id',
  YOUTUBE_OAUTH_CLIENT_SECRET: 'test-client-secret',
};

function mockTokenResponse(body: object, ok = true, status = 200) {
  return { ok, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

function mockChannelResponse(items: object[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ items }),
  } as Response;
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

describe('youtubeProvider.requiresPkce', () => {
  it('is false', () => {
    expect(youtubeProvider.requiresPkce).toBe(false);
  });
});

describe('youtubeProvider.authorizationUrl()', () => {
  it('throws when YOUTUBE_OAUTH_CLIENT_ID is missing', () => {
    vi.unstubAllEnvs();
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    delete process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
    expect(() =>
      youtubeProvider.authorizationUrl({ state: 'abc', redirectUri: 'http://localhost/cb' })
    ).toThrow('YOUTUBE_OAUTH_CLIENT_ID');
  });

  it('builds a Google accounts URL', () => {
    const url = youtubeProvider.authorizationUrl({ state: 'mystate', redirectUri: 'http://localhost/cb' });
    expect(url).toContain('accounts.google.com');
  });

  it('includes client_id in the URL', () => {
    const url = youtubeProvider.authorizationUrl({ state: 's', redirectUri: 'http://r/' });
    expect(url).toContain('client_id=test-client-id');
  });

  it('includes redirect_uri', () => {
    const url = youtubeProvider.authorizationUrl({ state: 's', redirectUri: 'http://r/cb' });
    expect(url).toContain('redirect_uri=');
  });

  it('includes state param', () => {
    const url = youtubeProvider.authorizationUrl({ state: 'csrf123', redirectUri: 'http://r/' });
    expect(url).toContain('state=csrf123');
  });

  it('requests offline access and forces consent prompt', () => {
    const url = youtubeProvider.authorizationUrl({ state: 's', redirectUri: 'http://r/' });
    expect(url).toContain('access_type=offline');
    expect(url).toContain('prompt=consent');
  });

  it('requests the youtube.upload scope', () => {
    const url = youtubeProvider.authorizationUrl({ state: 's', redirectUri: 'http://r/' });
    expect(url).toContain('youtube.upload');
  });

  it('sets response_type=code', () => {
    const url = youtubeProvider.authorizationUrl({ state: 's', redirectUri: 'http://r/' });
    expect(url).toContain('response_type=code');
  });
});

describe('youtubeProvider.exchangeCode()', () => {
  it('throws when YOUTUBE_OAUTH_CLIENT_ID is missing', async () => {
    vi.unstubAllEnvs();
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    delete process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
    await expect(
      youtubeProvider.exchangeCode({ code: 'c', redirectUri: 'http://r/' })
    ).rejects.toThrow('YOUTUBE_OAUTH_CLIENT_ID');
  });

  it('throws when the token endpoint returns an error', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      mockTokenResponse({ error: 'invalid_grant' }, false, 400)
    );
    vi.stubGlobal('fetch', mockFetch);
    await expect(
      youtubeProvider.exchangeCode({ code: 'bad-code', redirectUri: 'http://r/' })
    ).rejects.toThrow('YouTube token exchange failed');
  });

  it('throws when Google does not return a refresh_token', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        mockTokenResponse({ access_token: 'at', expires_in: 3600, scope: 'youtube.upload' })
      )
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) } as Response);
    vi.stubGlobal('fetch', mockFetch);
    await expect(
      youtubeProvider.exchangeCode({ code: 'code', redirectUri: 'http://r/' })
    ).rejects.toThrow('refresh_token');
  });

  it('returns token result with channel info on happy path', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        mockTokenResponse({
          access_token: 'at',
          refresh_token: 'rt',
          expires_in: 3600,
          scope: 'youtube.upload',
        })
      )
      .mockResolvedValueOnce(
        mockChannelResponse([{ id: 'UCabc', snippet: { title: 'My Channel' } }])
      );
    vi.stubGlobal('fetch', mockFetch);

    const result = await youtubeProvider.exchangeCode({ code: 'code', redirectUri: 'http://r/' });
    expect(result.accessToken).toBe('at');
    expect(result.refreshToken).toBe('rt');
    expect(result.externalAccountId).toBe('UCabc');
    expect(result.externalAccountLabel).toBe('My Channel');
    expect(result.expiresAt).toBeTruthy();
    expect(result.scope).toBe('youtube.upload');
  });

  it('returns null channel info when fetchOwnChannel fails', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        mockTokenResponse({
          access_token: 'at',
          refresh_token: 'rt',
          expires_in: 3600,
          scope: 'youtube.upload',
        })
      )
      .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({}) } as Response);
    vi.stubGlobal('fetch', mockFetch);

    const result = await youtubeProvider.exchangeCode({ code: 'code', redirectUri: 'http://r/' });
    expect(result.externalAccountId).toBeNull();
    expect(result.externalAccountLabel).toBeNull();
  });

  it('returns null channel info when fetchOwnChannel returns no items', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        mockTokenResponse({
          access_token: 'at',
          refresh_token: 'rt',
          expires_in: 3600,
          scope: 'youtube.upload',
        })
      )
      .mockResolvedValueOnce(mockChannelResponse([]));
    vi.stubGlobal('fetch', mockFetch);

    const result = await youtubeProvider.exchangeCode({ code: 'code', redirectUri: 'http://r/' });
    expect(result.externalAccountId).toBeNull();
  });

  it('returns null channel info when fetchOwnChannel throws', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        mockTokenResponse({
          access_token: 'at',
          refresh_token: 'rt',
          expires_in: 3600,
          scope: 'youtube.upload',
        })
      )
      .mockRejectedValueOnce(new Error('Network error'));
    vi.stubGlobal('fetch', mockFetch);

    const result = await youtubeProvider.exchangeCode({ code: 'code', redirectUri: 'http://r/' });
    expect(result.externalAccountId).toBeNull();
  });

  it('uses channel id as label when snippet.title is missing', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        mockTokenResponse({
          access_token: 'at',
          refresh_token: 'rt',
          expires_in: 3600,
          scope: 'youtube.upload',
        })
      )
      .mockResolvedValueOnce(
        mockChannelResponse([{ id: 'UCabc', snippet: {} }])
      );
    vi.stubGlobal('fetch', mockFetch);

    const result = await youtubeProvider.exchangeCode({ code: 'code', redirectUri: 'http://r/' });
    expect(result.externalAccountLabel).toBe('UCabc');
  });

  it('falls back to UPLOAD_SCOPE when scope is absent from response', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        mockTokenResponse({ access_token: 'at', refresh_token: 'rt', expires_in: 3600 })
      )
      .mockResolvedValueOnce(mockChannelResponse([]));
    vi.stubGlobal('fetch', mockFetch);

    const result = await youtubeProvider.exchangeCode({ code: 'c', redirectUri: 'http://r/' });
    expect(result.scope).toContain('youtube.upload');
  });

  it('sets expiresAt as ISO timestamp', async () => {
    const before = Date.now();
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        mockTokenResponse({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, scope: 'y' })
      )
      .mockResolvedValueOnce(mockChannelResponse([]));
    vi.stubGlobal('fetch', mockFetch);

    const result = await youtubeProvider.exchangeCode({ code: 'c', redirectUri: 'http://r/' });
    expect(result.expiresAt).toBeTruthy();
    const exp = new Date(result.expiresAt!).getTime();
    expect(exp).toBeGreaterThan(before);
  });
});

describe('youtubeProvider.refreshAccessToken()', () => {
  it('throws when YOUTUBE_OAUTH_CLIENT_ID is missing', async () => {
    vi.unstubAllEnvs();
    delete process.env.YOUTUBE_OAUTH_CLIENT_ID;
    await expect(youtubeProvider.refreshAccessToken('rt')).rejects.toThrow('YOUTUBE_OAUTH_CLIENT_ID');
  });

  it('throws when the token endpoint returns an error', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      mockTokenResponse({ error: 'invalid_grant' }, false, 401)
    );
    vi.stubGlobal('fetch', mockFetch);
    await expect(youtubeProvider.refreshAccessToken('bad-rt')).rejects.toThrow('YouTube token refresh failed');
  });

  it('returns new access token on success', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      mockTokenResponse({ access_token: 'new-at', expires_in: 3600 })
    );
    vi.stubGlobal('fetch', mockFetch);

    const result = await youtubeProvider.refreshAccessToken('rt');
    expect(result.accessToken).toBe('new-at');
    expect(result.expiresAt).toBeTruthy();
    expect(result.refreshToken).toBeNull();
  });

  it('returns rotated refresh token when Google provides one', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      mockTokenResponse({ access_token: 'new-at', refresh_token: 'new-rt', expires_in: 3600 })
    );
    vi.stubGlobal('fetch', mockFetch);

    const result = await youtubeProvider.refreshAccessToken('old-rt');
    expect(result.refreshToken).toBe('new-rt');
  });

  it('posts the refresh_token and grant_type to the correct endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      mockTokenResponse({ access_token: 'at', expires_in: 3600 })
    );
    vi.stubGlobal('fetch', mockFetch);

    await youtubeProvider.refreshAccessToken('my-rt');
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://oauth2.googleapis.com/token');
    const body = new URLSearchParams(init.body as string);
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('my-rt');
  });
});
