import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getOAuthProvider } from '@/lib/oauth/index';

// Helper to mock fetch with a given response
function mockFetch(body: unknown, status = 200) {
  return vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  }));
}

function withEnv(vars: Record<string, string>, fn: () => void | Promise<void>) {
  const original: Record<string, string | undefined> = {};
  for (const [k, v] of Object.entries(vars)) {
    original[k] = process.env[k];
    process.env[k] = v;
  }
  const result = fn();
  if (result instanceof Promise) {
    return result.finally(() => {
      for (const k of Object.keys(vars)) {
        if (original[k] === undefined) delete process.env[k];
        else process.env[k] = original[k];
      }
    });
  }
  for (const k of Object.keys(vars)) {
    if (original[k] === undefined) delete process.env[k];
    else process.env[k] = original[k];
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─────────────────────────── YouTube ───────────────────────────────────

describe('youtubeProvider.exchangeCode', () => {
  const env = { YOUTUBE_OAUTH_CLIENT_ID: 'yt-id', YOUTUBE_OAUTH_CLIENT_SECRET: 'yt-secret' };

  it('returns token result on success', async () => {
    await withEnv(env, async () => {
      mockFetch({
        access_token: 'yt-access',
        refresh_token: 'yt-refresh',
        expires_in: 3600,
        scope: 'https://www.googleapis.com/auth/youtube.upload',
      });
      // second fetch call (fetchOwnChannel) also needs mocking
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            access_token: 'yt-access',
            refresh_token: 'yt-refresh',
            expires_in: 3600,
            scope: 'https://www.googleapis.com/auth/youtube.upload',
          }),
          text: () => Promise.resolve(''),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve({
            items: [{ id: 'ch-123', snippet: { title: 'My Channel' } }],
          }),
          text: () => Promise.resolve(''),
        })
      );

      const p = getOAuthProvider('youtube');
      const result = await p.exchangeCode({ code: 'auth-code', redirectUri: 'https://example.com/cb' });
      expect(result.accessToken).toBe('yt-access');
      expect(result.refreshToken).toBe('yt-refresh');
      expect(result.externalAccountId).toBe('ch-123');
      expect(result.externalAccountLabel).toBe('My Channel');
    });
  });

  it('throws when response is not ok', async () => {
    await withEnv(env, async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('bad request'),
        json: () => Promise.resolve({}),
      }));
      const p = getOAuthProvider('youtube');
      await expect(p.exchangeCode({ code: 'bad', redirectUri: 'https://x.com' }))
        .rejects.toThrow('YouTube token exchange failed');
    });
  });

  it('throws when no refresh_token returned', async () => {
    await withEnv(env, async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ access_token: 'yt-access', expires_in: 3600 }),
        text: () => Promise.resolve(''),
      }));
      const p = getOAuthProvider('youtube');
      await expect(p.exchangeCode({ code: 'code', redirectUri: 'https://x.com' }))
        .rejects.toThrow('refresh_token');
    });
  });

  it('handles fetchOwnChannel failure gracefully (returns null ids)', async () => {
    await withEnv(env, async () => {
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: () => Promise.resolve({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, scope: 'yt.upload' }),
          text: () => Promise.resolve(''),
        })
        .mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}), text: () => Promise.resolve('') })
      );
      const p = getOAuthProvider('youtube');
      const result = await p.exchangeCode({ code: 'code', redirectUri: 'https://x.com' });
      expect(result.externalAccountId).toBeNull();
      expect(result.externalAccountLabel).toBeNull();
    });
  });
});

describe('youtubeProvider.refreshAccessToken', () => {
  const env = { YOUTUBE_OAUTH_CLIENT_ID: 'yt-id', YOUTUBE_OAUTH_CLIENT_SECRET: 'yt-secret' };

  it('returns new access token on success', async () => {
    await withEnv(env, async () => {
      mockFetch({ access_token: 'new-yt-access', expires_in: 3600 });
      const p = getOAuthProvider('youtube');
      const result = await p.refreshAccessToken('old-refresh-token');
      expect(result.accessToken).toBe('new-yt-access');
      expect(result.refreshToken).toBeNull();
      expect(typeof result.expiresAt).toBe('string');
    });
  });

  it('propagates rotated refresh_token when provided', async () => {
    await withEnv(env, async () => {
      mockFetch({ access_token: 'new-at', expires_in: 3600, refresh_token: 'rotated-rt' });
      const p = getOAuthProvider('youtube');
      const result = await p.refreshAccessToken('old-rt');
      expect(result.refreshToken).toBe('rotated-rt');
    });
  });

  it('throws when response is not ok', async () => {
    await withEnv(env, async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false, status: 401,
        text: () => Promise.resolve('unauthorized'),
        json: () => Promise.resolve({}),
      }));
      const p = getOAuthProvider('youtube');
      await expect(p.refreshAccessToken('bad-refresh')).rejects.toThrow('YouTube token refresh failed');
    });
  });
});

// ─────────────────────────── TikTok ───────────────────────────────────

describe('tiktokProvider.exchangeCode', () => {
  const env = { TIKTOK_OAUTH_CLIENT_KEY: 'tt-key', TIKTOK_OAUTH_CLIENT_SECRET: 'tt-secret' };

  it('returns token result on success', async () => {
    await withEnv(env, async () => {
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: () => Promise.resolve({
            access_token: 'tt-access', refresh_token: 'tt-refresh',
            expires_in: 7200, open_id: 'tt-user-id', scope: 'video.publish',
          }),
          text: () => Promise.resolve(''),
        })
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: () => Promise.resolve({ data: { user: { display_name: 'TikTok Creator' } } }),
          text: () => Promise.resolve(''),
        })
      );
      const p = getOAuthProvider('tiktok');
      const result = await p.exchangeCode({ code: 'code', redirectUri: 'https://x.com/cb' });
      expect(result.accessToken).toBe('tt-access');
      expect(result.refreshToken).toBe('tt-refresh');
      expect(result.externalAccountId).toBe('tt-user-id');
      expect(result.externalAccountLabel).toBe('TikTok Creator');
    });
  });

  it('throws when body has error field', async () => {
    await withEnv(env, async () => {
      mockFetch({ error: 'invalid_code', error_description: 'bad' }, 400);
      const p = getOAuthProvider('tiktok');
      await expect(p.exchangeCode({ code: 'bad', redirectUri: 'https://x.com' }))
        .rejects.toThrow('TikTok token exchange failed');
    });
  });

  it('handles no expires_in gracefully (expiresAt is null)', async () => {
    await withEnv(env, async () => {
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: () => Promise.resolve({ access_token: 'at', open_id: 'uid', scope: 'video.publish' }),
          text: () => Promise.resolve(''),
        })
        .mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}), text: () => Promise.resolve('') })
      );
      const p = getOAuthProvider('tiktok');
      const result = await p.exchangeCode({ code: 'code', redirectUri: 'https://x.com' });
      expect(result.expiresAt).toBeNull();
    });
  });

  it('handles fetchDisplayName failure gracefully', async () => {
    await withEnv(env, async () => {
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: () => Promise.resolve({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, open_id: 'id', scope: 'video.publish' }),
          text: () => Promise.resolve(''),
        })
        .mockRejectedValueOnce(new Error('network error'))
      );
      const p = getOAuthProvider('tiktok');
      const result = await p.exchangeCode({ code: 'code', redirectUri: 'https://x.com' });
      expect(result.externalAccountLabel).toBeNull();
    });
  });
});

describe('tiktokProvider.refreshAccessToken', () => {
  const env = { TIKTOK_OAUTH_CLIENT_KEY: 'tt-key', TIKTOK_OAUTH_CLIENT_SECRET: 'tt-secret' };

  it('returns new access token on success', async () => {
    await withEnv(env, async () => {
      mockFetch({ access_token: 'new-tt-at', expires_in: 3600, refresh_token: 'new-rt' });
      const p = getOAuthProvider('tiktok');
      const result = await p.refreshAccessToken('old-rt');
      expect(result.accessToken).toBe('new-tt-at');
      expect(result.refreshToken).toBe('new-rt');
    });
  });

  it('throws when body has error field', async () => {
    await withEnv(env, async () => {
      mockFetch({ error: 'token_expired' }, 401);
      const p = getOAuthProvider('tiktok');
      await expect(p.refreshAccessToken('expired')).rejects.toThrow('TikTok token refresh failed');
    });
  });
});

// ─────────────────────────── Facebook ─────────────────────────────────

describe('facebookProvider.exchangeCode', () => {
  const env = { FACEBOOK_APP_ID: 'fb-id', FACEBOOK_APP_SECRET: 'fb-secret' };

  it('returns token result on success', async () => {
    await withEnv(env, async () => {
      vi.stubGlobal('fetch', vi.fn()
        // 1. short-lived token exchange
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ access_token: 'short' }), text: () => Promise.resolve('') })
        // 2. long-lived token exchange
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ access_token: 'long-lived' }), text: () => Promise.resolve('') })
        // 3. /me/accounts fetch
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: () => Promise.resolve({ data: [{ id: 'page-123', name: 'My Page', access_token: 'page-token' }] }),
          text: () => Promise.resolve(''),
        })
      );
      const p = getOAuthProvider('facebook');
      const result = await p.exchangeCode({ code: 'code', redirectUri: 'https://x.com/cb' });
      expect(result.accessToken).toBe('page-token');
      expect(result.externalAccountId).toBe('page-123');
      expect(result.externalAccountLabel).toBe('My Page');
      expect(result.refreshToken).toBe('long-lived');
      expect(result.expiresAt).toBeNull();
    });
  });

  it('throws when no access_token in short-lived response', async () => {
    await withEnv(env, async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true, status: 200,
        json: () => Promise.resolve({ error: { message: 'bad code' } }),
        text: () => Promise.resolve(''),
      }));
      const p = getOAuthProvider('facebook');
      await expect(p.exchangeCode({ code: 'bad', redirectUri: 'https://x.com' }))
        .rejects.toThrow();
    });
  });

  it('throws when no Facebook Pages are associated', async () => {
    await withEnv(env, async () => {
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ access_token: 'short' }), text: () => Promise.resolve('') })
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ access_token: 'long' }), text: () => Promise.resolve('') })
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({ data: [] }), text: () => Promise.resolve('') })
      );
      const p = getOAuthProvider('facebook');
      await expect(p.exchangeCode({ code: 'code', redirectUri: 'https://x.com' }))
        .rejects.toThrow('no Pages');
    });
  });
});

describe('facebookProvider.refreshAccessToken', () => {
  const env = { FACEBOOK_APP_ID: 'fb-id', FACEBOOK_APP_SECRET: 'fb-secret' };

  it('returns new page access token using stored user token', async () => {
    await withEnv(env, async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true, status: 200,
        json: () => Promise.resolve({ data: [{ id: 'page-1', name: 'Page', access_token: 'fresh-page-token' }] }),
        text: () => Promise.resolve(''),
      }));
      const p = getOAuthProvider('facebook');
      const result = await p.refreshAccessToken('stored-user-token');
      expect(result.accessToken).toBe('fresh-page-token');
      expect(result.expiresAt).toBeNull();
      expect(result.refreshToken).toBeNull();
    });
  });

  it('throws when stored user token is no longer valid', async () => {
    await withEnv(env, async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true, status: 200,
        json: () => Promise.resolve({ data: [] }),
        text: () => Promise.resolve(''),
      }));
      const p = getOAuthProvider('facebook');
      await expect(p.refreshAccessToken('expired-user-token')).rejects.toThrow('no longer valid');
    });
  });
});

// ─────────────────────────── Canva ────────────────────────────────────

describe('canvaProvider.exchangeCode', () => {
  const env = { CANVA_CLIENT_ID: 'cv-id', CANVA_CLIENT_SECRET: 'cv-secret' };

  it('returns token result on success', async () => {
    await withEnv(env, async () => {
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: () => Promise.resolve({ access_token: 'cv-at', refresh_token: 'cv-rt', expires_in: 3600, scope: 'design:content:write' }),
          text: () => Promise.resolve(''),
        })
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: () => Promise.resolve({ display_name: 'Design User' }),
          text: () => Promise.resolve(''),
        })
      );
      const p = getOAuthProvider('canva');
      const result = await p.exchangeCode({ code: 'code', redirectUri: 'https://x.com/cb', codeVerifier: 'verifier' });
      expect(result.accessToken).toBe('cv-at');
      expect(result.refreshToken).toBe('cv-rt');
      expect(result.externalAccountLabel).toBe('Design User');
      expect(result.externalAccountId).toBeNull(); // Canva doesn't expose stable user id
    });
  });

  it('throws when response is not ok', async () => {
    await withEnv(env, async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false, status: 400,
        text: () => Promise.resolve('invalid_grant'),
        json: () => Promise.resolve({}),
      }));
      const p = getOAuthProvider('canva');
      await expect(p.exchangeCode({ code: 'bad', redirectUri: 'https://x.com', codeVerifier: 'v' }))
        .rejects.toThrow('Canva token exchange failed');
    });
  });

  it('handles fetchDisplayName failure gracefully', async () => {
    await withEnv(env, async () => {
      vi.stubGlobal('fetch', vi.fn()
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: () => Promise.resolve({ access_token: 'cv-at', expires_in: 3600, scope: 'ds' }),
          text: () => Promise.resolve(''),
        })
        .mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve({}), text: () => Promise.resolve('') })
      );
      const p = getOAuthProvider('canva');
      const result = await p.exchangeCode({ code: 'code', redirectUri: 'https://x.com', codeVerifier: 'v' });
      expect(result.externalAccountLabel).toBeNull();
    });
  });
});

describe('canvaProvider.refreshAccessToken', () => {
  const env = { CANVA_CLIENT_ID: 'cv-id', CANVA_CLIENT_SECRET: 'cv-secret' };

  it('returns new access token on success', async () => {
    await withEnv(env, async () => {
      mockFetch({ access_token: 'new-cv-at', expires_in: 3600, refresh_token: 'new-cv-rt' });
      const p = getOAuthProvider('canva');
      const result = await p.refreshAccessToken('old-rt');
      expect(result.accessToken).toBe('new-cv-at');
      expect(result.refreshToken).toBe('new-cv-rt');
      expect(typeof result.expiresAt).toBe('string');
    });
  });

  it('throws when response is not ok', async () => {
    await withEnv(env, async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false, status: 401,
        text: () => Promise.resolve('unauthorized'),
        json: () => Promise.resolve({}),
      }));
      const p = getOAuthProvider('canva');
      await expect(p.refreshAccessToken('bad-rt')).rejects.toThrow('Canva token refresh failed');
    });
  });
});
