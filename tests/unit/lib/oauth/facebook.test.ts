import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { facebookProvider } from '@/lib/oauth/facebook';

const ENV = {
  FACEBOOK_APP_ID: 'test-app-id',
  FACEBOOK_APP_SECRET: 'test-app-secret',
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

describe('facebookProvider.requiresPkce', () => {
  it('is false', () => {
    expect(facebookProvider.requiresPkce).toBe(false);
  });
});

describe('facebookProvider.authorizationUrl()', () => {
  it('throws when FACEBOOK_APP_ID is missing', () => {
    vi.unstubAllEnvs();
    delete process.env.FACEBOOK_APP_ID;
    expect(() =>
      facebookProvider.authorizationUrl({ state: 's', redirectUri: 'http://r/' })
    ).toThrow('FACEBOOK_APP_ID');
  });

  it('builds a Facebook dialog URL', () => {
    const url = facebookProvider.authorizationUrl({ state: 's', redirectUri: 'http://r/' });
    expect(url).toContain('facebook.com');
    expect(url).toContain('dialog/oauth');
  });

  it('includes client_id', () => {
    const url = facebookProvider.authorizationUrl({ state: 's', redirectUri: 'http://r/' });
    expect(url).toContain('client_id=test-app-id');
  });

  it('includes state', () => {
    const url = facebookProvider.authorizationUrl({ state: 'csrf_abc', redirectUri: 'http://r/' });
    expect(url).toContain('state=csrf_abc');
  });

  it('includes page management scopes', () => {
    const url = facebookProvider.authorizationUrl({ state: 's', redirectUri: 'http://r/' });
    expect(url).toContain('pages_show_list');
  });

  it('sets response_type=code', () => {
    const url = facebookProvider.authorizationUrl({ state: 's', redirectUri: 'http://r/' });
    expect(url).toContain('response_type=code');
  });
});

describe('facebookProvider.exchangeCode()', () => {
  it('throws when FACEBOOK_APP_ID is missing', async () => {
    vi.unstubAllEnvs();
    delete process.env.FACEBOOK_APP_ID;
    await expect(
      facebookProvider.exchangeCode({ code: 'c', redirectUri: 'http://r/' })
    ).rejects.toThrow('FACEBOOK_APP_ID');
  });

  it('throws when short-lived token exchange fails (API error field)', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      mockOk({ error: { message: 'Invalid code', code: 100 } })
    );
    vi.stubGlobal('fetch', mockFetch);
    await expect(
      facebookProvider.exchangeCode({ code: 'bad', redirectUri: 'http://r/' })
    ).rejects.toThrow('Facebook Graph API call failed');
  });

  it('throws when short-lived token exchange returns no access_token', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(mockOk({ token_type: 'bearer' }));
    vi.stubGlobal('fetch', mockFetch);
    await expect(
      facebookProvider.exchangeCode({ code: 'bad', redirectUri: 'http://r/' })
    ).rejects.toThrow('no access_token');
  });

  it('throws when long-lived token exchange fails', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(mockOk({ access_token: 'short-at' }))
      .mockResolvedValueOnce(mockOk({ error: { message: 'App secret wrong', code: 2 } }));
    vi.stubGlobal('fetch', mockFetch);
    await expect(
      facebookProvider.exchangeCode({ code: 'c', redirectUri: 'http://r/' })
    ).rejects.toThrow('Facebook Graph API call failed');
  });

  it('throws when long-lived exchange returns no access_token', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(mockOk({ access_token: 'short-at' }))
      .mockResolvedValueOnce(mockOk({ token_type: 'bearer' }));
    vi.stubGlobal('fetch', mockFetch);
    await expect(
      facebookProvider.exchangeCode({ code: 'c', redirectUri: 'http://r/' })
    ).rejects.toThrow('long-lived token exchange failed');
  });

  it('throws when the account has no Pages', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(mockOk({ access_token: 'short-at' }))
      .mockResolvedValueOnce(mockOk({ access_token: 'long-at' }))
      .mockResolvedValueOnce(mockOk({ data: [] }));
    vi.stubGlobal('fetch', mockFetch);
    await expect(
      facebookProvider.exchangeCode({ code: 'c', redirectUri: 'http://r/' })
    ).rejects.toThrow('no Pages');
  });

  it('throws when /me/accounts returns no access_token on first page', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(mockOk({ access_token: 'short-at' }))
      .mockResolvedValueOnce(mockOk({ access_token: 'long-at' }))
      .mockResolvedValueOnce(mockOk({ data: [{ id: 'page1', name: 'My Page' }] }));
    vi.stubGlobal('fetch', mockFetch);
    await expect(
      facebookProvider.exchangeCode({ code: 'c', redirectUri: 'http://r/' })
    ).rejects.toThrow('no Pages');
  });

  it('returns token result with page info on happy path', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(mockOk({ access_token: 'short-at' }))
      .mockResolvedValueOnce(mockOk({ access_token: 'long-at' }))
      .mockResolvedValueOnce(
        mockOk({ data: [{ id: 'page123', name: 'Cool Page', access_token: 'page-at' }] })
      );
    vi.stubGlobal('fetch', mockFetch);

    const result = await facebookProvider.exchangeCode({ code: 'c', redirectUri: 'http://r/' });
    expect(result.accessToken).toBe('page-at');
    expect(result.refreshToken).toBe('long-at');
    expect(result.externalAccountId).toBe('page123');
    expect(result.externalAccountLabel).toBe('Cool Page');
    expect(result.expiresAt).toBeNull();
    expect(result.scope).toContain('pages_show_list');
  });

  it('falls back to page id as name when name is missing', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(mockOk({ access_token: 'short-at' }))
      .mockResolvedValueOnce(mockOk({ access_token: 'long-at' }))
      .mockResolvedValueOnce(
        mockOk({ data: [{ id: 'page456', access_token: 'page-at' }] })
      );
    vi.stubGlobal('fetch', mockFetch);

    const result = await facebookProvider.exchangeCode({ code: 'c', redirectUri: 'http://r/' });
    expect(result.externalAccountLabel).toBe('page456');
  });

  it('throws when getJson receives a non-ok HTTP response', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(mockErr({ error: 'fail' }, 500));
    vi.stubGlobal('fetch', mockFetch);
    await expect(
      facebookProvider.exchangeCode({ code: 'c', redirectUri: 'http://r/' })
    ).rejects.toThrow('Facebook Graph API call failed');
  });
});

describe('facebookProvider.refreshAccessToken()', () => {
  it('throws when /me/accounts returns no pages (null)', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(mockOk({ data: [] }));
    vi.stubGlobal('fetch', mockFetch);
    await expect(facebookProvider.refreshAccessToken('user-token')).rejects.toThrow('re-derivation failed');
  });

  it('re-derives Page access token from stored long-lived user token', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(
      mockOk({ data: [{ id: 'page789', name: 'Test Page', access_token: 'new-page-at' }] })
    );
    vi.stubGlobal('fetch', mockFetch);

    const result = await facebookProvider.refreshAccessToken('long-user-at');
    expect(result.accessToken).toBe('new-page-at');
    expect(result.expiresAt).toBeNull();
    expect(result.refreshToken).toBeNull();
  });

  it('throws when getJson fails on the /me/accounts call', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(mockErr({ error: 'expired' }, 401));
    vi.stubGlobal('fetch', mockFetch);
    await expect(facebookProvider.refreshAccessToken('old-token')).rejects.toThrow('Facebook Graph API call failed');
  });
});
