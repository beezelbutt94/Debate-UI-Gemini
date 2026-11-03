/**
 * Targeted tests for remaining uncovered branches to reach ≥98% overall.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── platform-api: non-JSON error body ───────────────────────────────────────

describe('platformApiFetch() — non-JSON error body', () => {
  beforeEach(() => { vi.resetModules(); });
  afterEach(() => { vi.restoreAllMocks(); });

  it('falls back to status-code message when error body is not valid JSON', async () => {
    let call = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      if (call++ === 0) {
        return { ok: true, json: async () => ({ configured: true }), headers: { get: () => null } };
      }
      return {
        ok: false,
        status: 502,
        json: async () => { throw new SyntaxError('not json'); },
        headers: { get: () => null },
      };
    }));
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/broken');
    expect(result).toMatchObject({ state: 'error', message: 'Request failed (502)' });
  });
});

// ─── OAuth requireEnv for secrets ─────────────────────────────────────────────

describe('youtubeProvider — missing YOUTUBE_OAUTH_CLIENT_SECRET', () => {
  afterEach(() => { vi.restoreAllMocks(); delete process.env.YOUTUBE_OAUTH_CLIENT_ID; delete process.env.YOUTUBE_OAUTH_CLIENT_SECRET; });

  it('throws when YOUTUBE_OAUTH_CLIENT_SECRET is not set during exchangeCode', async () => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'yt-id';
    // YOUTUBE_OAUTH_CLIENT_SECRET not set
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 400, text: async () => 'Bad Request',
    })));
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    // The requireEnv for SECRET is called inside exchangeCode body builder
    await expect(youtubeProvider.exchangeCode({ code: 'c', redirectUri: 'https://x.com' }))
      .rejects.toThrow('YOUTUBE_OAUTH_CLIENT_SECRET');
  });
});

describe('tiktokProvider — missing TIKTOK_OAUTH_CLIENT_SECRET', () => {
  afterEach(() => { vi.restoreAllMocks(); delete process.env.TIKTOK_OAUTH_CLIENT_KEY; delete process.env.TIKTOK_OAUTH_CLIENT_SECRET; });

  it('throws when TIKTOK_OAUTH_CLIENT_SECRET is not set during exchangeCode', async () => {
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'tt-key';
    // TIKTOK_OAUTH_CLIENT_SECRET not set
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    await expect(tiktokProvider.exchangeCode({ code: 'c', redirectUri: 'https://x.com' }))
      .rejects.toThrow('TIKTOK_OAUTH_CLIENT_SECRET');
  });
});

describe('facebookProvider — missing FACEBOOK_APP_SECRET', () => {
  afterEach(() => { vi.restoreAllMocks(); delete process.env.FACEBOOK_APP_ID; delete process.env.FACEBOOK_APP_SECRET; });

  it('throws when FACEBOOK_APP_SECRET is not set during exchangeCode', async () => {
    process.env.FACEBOOK_APP_ID = 'fb-id';
    // FACEBOOK_APP_SECRET not set
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    await expect(facebookProvider.exchangeCode({ code: 'c', redirectUri: 'https://x.com' }))
      .rejects.toThrow('FACEBOOK_APP_SECRET');
  });
});

// ─── Facebook fetchFirstPage: data[0] exists but has no access_token ─────────

describe('facebookProvider.exchangeCode() — page with no access_token', () => {
  afterEach(() => { vi.restoreAllMocks(); delete process.env.FACEBOOK_APP_ID; delete process.env.FACEBOOK_APP_SECRET; });

  it('throws "no Pages" when first page entry lacks an access_token', async () => {
    process.env.FACEBOOK_APP_ID = 'fb-id';
    process.env.FACEBOOK_APP_SECRET = 'fb-secret';
    let call = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      call++;
      if (call === 1) return { ok: true, status: 200, json: async () => ({ access_token: 'short' }) };
      if (call === 2) return { ok: true, status: 200, json: async () => ({ access_token: 'long' }) };
      // /me/accounts returns a page entry but without access_token
      return { ok: true, status: 200, json: async () => ({ data: [{ id: 'pg', name: 'My Page' }] }) };
    }));
    const { facebookProvider } = await import('@/lib/oauth/facebook');
    await expect(facebookProvider.exchangeCode({ code: 'c', redirectUri: 'https://x.com' }))
      .rejects.toThrow('no Pages');
  });
});

// ─── canva fetchDisplayName: catch branch ─────────────────────────────────────

describe('canvaProvider.exchangeCode() — display name fetch throws', () => {
  afterEach(() => { vi.restoreAllMocks(); delete process.env.CANVA_CLIENT_ID; delete process.env.CANVA_CLIENT_SECRET; });

  it('returns null label when fetchDisplayName throws entirely', async () => {
    process.env.CANVA_CLIENT_ID = 'canva-id';
    process.env.CANVA_CLIENT_SECRET = 'canva-secret';
    let call = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      if (call++ === 0) {
        return {
          ok: true, status: 200,
          json: async () => ({ access_token: 'canva-access', refresh_token: 'rt', expires_in: 3600, scope: 'profile:read' }),
          text: async () => '',
        };
      }
      throw new Error('network failure in display name fetch');
    }));
    const { canvaProvider } = await import('@/lib/oauth/canva');
    const result = await canvaProvider.exchangeCode({ code: 'c', redirectUri: 'https://x.com', codeVerifier: 'v' });
    expect(result.externalAccountLabel).toBeNull();
  });
});

// ─── tiktokProvider fetchDisplayName: catch branch ────────────────────────────

describe('tiktokProvider.exchangeCode() — display name fetch throws', () => {
  afterEach(() => { vi.restoreAllMocks(); delete process.env.TIKTOK_OAUTH_CLIENT_KEY; delete process.env.TIKTOK_OAUTH_CLIENT_SECRET; });

  it('returns null label when fetchDisplayName throws', async () => {
    process.env.TIKTOK_OAUTH_CLIENT_KEY = 'tt-key';
    process.env.TIKTOK_OAUTH_CLIENT_SECRET = 'tt-secret';
    let call = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      if (call++ === 0) {
        return {
          ok: true, status: 200,
          json: async () => ({ access_token: 'tt-access', refresh_token: 'rt', expires_in: 86400, scope: 'video.publish' }),
        };
      }
      throw new Error('network failure');
    }));
    const { tiktokProvider } = await import('@/lib/oauth/tiktok');
    const result = await tiktokProvider.exchangeCode({ code: 'c', redirectUri: 'https://x.com' });
    expect(result.externalAccountLabel).toBeNull();
  });
});

// ─── youtubeProvider fetchOwnChannel: catch branch ───────────────────────────

describe('youtubeProvider.exchangeCode() — channel fetch throws', () => {
  afterEach(() => { vi.restoreAllMocks(); delete process.env.YOUTUBE_OAUTH_CLIENT_ID; delete process.env.YOUTUBE_OAUTH_CLIENT_SECRET; });

  it('returns null channel info when fetchOwnChannel throws', async () => {
    process.env.YOUTUBE_OAUTH_CLIENT_ID = 'yt-id';
    process.env.YOUTUBE_OAUTH_CLIENT_SECRET = 'yt-secret';
    let call = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      if (call++ === 0) {
        return {
          ok: true, status: 200,
          json: async () => ({ access_token: 'at', refresh_token: 'rt', expires_in: 3600, scope: 'upload' }),
          text: async () => '',
        };
      }
      throw new Error('network error in channel fetch');
    }));
    const { youtubeProvider } = await import('@/lib/oauth/youtube');
    const result = await youtubeProvider.exchangeCode({ code: 'c', redirectUri: 'https://x.com' });
    expect(result.externalAccountId).toBeNull();
    expect(result.externalAccountLabel).toBeNull();
  });
});
