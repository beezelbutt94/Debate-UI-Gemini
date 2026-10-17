import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { canvaProvider } from '@/lib/oauth/canva';

const ENV = {
  CANVA_CLIENT_ID: 'test-canva-id',
  CANVA_CLIENT_SECRET: 'test-canva-secret',
};

function mockOk(body: object) {
  return { ok: true, status: 200, json: async () => body, text: async () => '' } as Response;
}

function mockErr(status = 400, text = 'error') {
  return { ok: false, status, json: async () => ({}), text: async () => text } as unknown as Response;
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

describe('canvaProvider.requiresPkce', () => {
  it('is true', () => {
    expect(canvaProvider.requiresPkce).toBe(true);
  });
});

describe('canvaProvider.authorizationUrl()', () => {
  it('throws when CANVA_CLIENT_ID is missing', () => {
    vi.unstubAllEnvs();
    delete process.env.CANVA_CLIENT_ID;
    delete process.env.CANVA_CLIENT_SECRET;
    expect(() =>
      canvaProvider.authorizationUrl({ state: 's', redirectUri: 'http://r/', codeChallenge: 'cc' })
    ).toThrow('CANVA_CLIENT_ID');
  });

  it('builds a Canva authorization URL', () => {
    const url = canvaProvider.authorizationUrl({ state: 's', redirectUri: 'http://r/', codeChallenge: 'cc' });
    expect(url).toContain('canva.com');
    expect(url).toContain('oauth/authorize');
  });

  it('includes client_id', () => {
    const url = canvaProvider.authorizationUrl({ state: 's', redirectUri: 'http://r/', codeChallenge: 'cc' });
    expect(url).toContain('client_id=test-canva-id');
  });

  it('includes state', () => {
    const url = canvaProvider.authorizationUrl({ state: 'pkce_state', redirectUri: 'http://r/', codeChallenge: 'cc' });
    expect(url).toContain('state=pkce_state');
  });

  it('includes code_challenge', () => {
    const url = canvaProvider.authorizationUrl({ state: 's', redirectUri: 'http://r/', codeChallenge: 'mychallenge' });
    expect(url).toContain('code_challenge=mychallenge');
  });

  it('sets code_challenge_method=S256', () => {
    const url = canvaProvider.authorizationUrl({ state: 's', redirectUri: 'http://r/', codeChallenge: 'cc' });
    expect(url).toContain('code_challenge_method=S256');
  });

  it('includes expected scopes', () => {
    const url = canvaProvider.authorizationUrl({ state: 's', redirectUri: 'http://r/', codeChallenge: 'cc' });
    expect(url).toContain('design');
    expect(url).toContain('profile');
  });

  it('sets response_type=code', () => {
    const url = canvaProvider.authorizationUrl({ state: 's', redirectUri: 'http://r/', codeChallenge: 'cc' });
    expect(url).toContain('response_type=code');
  });

  it('uses empty code_challenge when not provided', () => {
    const url = canvaProvider.authorizationUrl({ state: 's', redirectUri: 'http://r/' });
    expect(url).toContain('code_challenge=');
  });
});

describe('canvaProvider.exchangeCode()', () => {
  it('throws when CANVA_CLIENT_ID is missing', async () => {
    vi.unstubAllEnvs();
    delete process.env.CANVA_CLIENT_ID;
    delete process.env.CANVA_CLIENT_SECRET;
    await expect(
      canvaProvider.exchangeCode({ code: 'c', redirectUri: 'http://r/', codeVerifier: 'cv' })
    ).rejects.toThrow('CANVA_CLIENT_ID');
  });

  it('throws when token endpoint returns an error', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(mockErr(400, 'invalid_grant'));
    vi.stubGlobal('fetch', mockFetch);
    await expect(
      canvaProvider.exchangeCode({ code: 'bad', redirectUri: 'http://r/', codeVerifier: 'cv' })
    ).rejects.toThrow('Canva token exchange failed');
  });

  it('returns token result with display name on happy path', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        mockOk({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, scope: 'design:content:write' })
      )
      .mockResolvedValueOnce(mockOk({ display_name: 'Design User' }));
    vi.stubGlobal('fetch', mockFetch);

    const result = await canvaProvider.exchangeCode({ code: 'code', redirectUri: 'http://r/', codeVerifier: 'cv' });
    expect(result.accessToken).toBe('at');
    expect(result.refreshToken).toBe('rt');
    expect(result.externalAccountId).toBeNull();
    expect(result.externalAccountLabel).toBe('Design User');
    expect(result.expiresAt).toBeTruthy();
    expect(result.scope).toBe('design:content:write');
  });

  it('returns null label when profile fetch fails', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        mockOk({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, scope: 's' })
      )
      .mockResolvedValueOnce(mockErr(403));
    vi.stubGlobal('fetch', mockFetch);

    const result = await canvaProvider.exchangeCode({ code: 'c', redirectUri: 'http://r/', codeVerifier: 'cv' });
    expect(result.externalAccountLabel).toBeNull();
  });

  it('returns null label when profile fetch throws', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        mockOk({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, scope: 's' })
      )
      .mockRejectedValueOnce(new Error('network'));
    vi.stubGlobal('fetch', mockFetch);

    const result = await canvaProvider.exchangeCode({ code: 'c', redirectUri: 'http://r/', codeVerifier: 'cv' });
    expect(result.externalAccountLabel).toBeNull();
  });

  it('returns null label when display_name is missing from profile', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(
        mockOk({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, scope: 's' })
      )
      .mockResolvedValueOnce(mockOk({}));
    vi.stubGlobal('fetch', mockFetch);

    const result = await canvaProvider.exchangeCode({ code: 'c', redirectUri: 'http://r/', codeVerifier: 'cv' });
    expect(result.externalAccountLabel).toBeNull();
  });

  it('returns null refresh_token when absent', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(mockOk({ access_token: 'at', expires_in: 3600, scope: 's' }))
      .mockResolvedValueOnce(mockOk({}));
    vi.stubGlobal('fetch', mockFetch);

    const result = await canvaProvider.exchangeCode({ code: 'c', redirectUri: 'http://r/', codeVerifier: 'cv' });
    expect(result.refreshToken).toBeNull();
  });

  it('uses empty codeVerifier when not provided', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(mockOk({ access_token: 'at', expires_in: 3600, scope: 's' }))
      .mockResolvedValueOnce(mockOk({}));
    vi.stubGlobal('fetch', mockFetch);

    const result = await canvaProvider.exchangeCode({ code: 'c', redirectUri: 'http://r/' });
    expect(result.accessToken).toBe('at');
    const [, init] = mockFetch.mock.calls[0];
    const body = new URLSearchParams(init.body as string);
    expect(body.get('code_verifier')).toBe('');
  });

  it('sends Basic auth header with correct base64 encoding', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(mockOk({ access_token: 'at', expires_in: 3600, scope: 's' }))
      .mockResolvedValueOnce(mockOk({}));
    vi.stubGlobal('fetch', mockFetch);

    await canvaProvider.exchangeCode({ code: 'c', redirectUri: 'http://r/', codeVerifier: 'cv' });
    const [, init] = mockFetch.mock.calls[0];
    const expectedBase64 = Buffer.from('test-canva-id:test-canva-secret').toString('base64');
    expect(init.headers['Authorization']).toBe(`Basic ${expectedBase64}`);
  });

  it('uses fallback scope when response scope is absent', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(mockOk({ access_token: 'at', expires_in: 3600 }))
      .mockResolvedValueOnce(mockOk({}));
    vi.stubGlobal('fetch', mockFetch);

    const result = await canvaProvider.exchangeCode({ code: 'c', redirectUri: 'http://r/', codeVerifier: 'cv' });
    expect(result.scope).toContain('design');
  });
});

describe('canvaProvider.refreshAccessToken()', () => {
  it('throws when CANVA_CLIENT_ID is missing', async () => {
    vi.unstubAllEnvs();
    delete process.env.CANVA_CLIENT_ID;
    delete process.env.CANVA_CLIENT_SECRET;
    await expect(canvaProvider.refreshAccessToken('rt')).rejects.toThrow('CANVA_CLIENT_ID');
  });

  it('throws when token endpoint returns an error', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(mockErr(401, 'expired'));
    vi.stubGlobal('fetch', mockFetch);
    await expect(canvaProvider.refreshAccessToken('bad-rt')).rejects.toThrow('Canva token refresh failed');
  });

  it('returns new access token on success', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      mockOk({ access_token: 'new-at', expires_in: 3600 })
    );
    vi.stubGlobal('fetch', mockFetch);

    const result = await canvaProvider.refreshAccessToken('old-rt');
    expect(result.accessToken).toBe('new-at');
    expect(result.expiresAt).toBeTruthy();
    expect(result.refreshToken).toBeNull();
  });

  it('returns rotated refresh token when provided', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      mockOk({ access_token: 'new-at', refresh_token: 'new-rt', expires_in: 3600 })
    );
    vi.stubGlobal('fetch', mockFetch);

    const result = await canvaProvider.refreshAccessToken('old-rt');
    expect(result.refreshToken).toBe('new-rt');
  });

  it('posts grant_type=refresh_token with the stored refresh token', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      mockOk({ access_token: 'at', expires_in: 3600 })
    );
    vi.stubGlobal('fetch', mockFetch);

    await canvaProvider.refreshAccessToken('my-rt');
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toContain('canva.com');
    const body = new URLSearchParams(init.body as string);
    expect(body.get('grant_type')).toBe('refresh_token');
    expect(body.get('refresh_token')).toBe('my-rt');
  });
});
