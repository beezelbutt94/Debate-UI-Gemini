/**
 * Edge-case tests targeting the remaining uncovered branches in the OAuth
 * provider files (as identified by the v8 coverage report):
 *   youtube.ts:105   snippet.title missing → falls back to item.id
 *   tiktok.ts:101    fetchDisplayName fetch throws → catch returns null
 *   facebook.ts:52   shortLived.access_token absent → throws
 *   facebook.ts:62   longLived.access_token absent → throws
 *   canva.ts:104     display_name absent in profile body → null
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getOAuthProvider } from '@/lib/oauth/index';

beforeEach(() => {
  process.env.YOUTUBE_OAUTH_CLIENT_ID = 'yt-id';
  process.env.YOUTUBE_OAUTH_CLIENT_SECRET = 'yt-secret';
  process.env.TIKTOK_OAUTH_CLIENT_KEY = 'tt-key';
  process.env.TIKTOK_OAUTH_CLIENT_SECRET = 'tt-secret';
  process.env.FACEBOOK_APP_ID = 'fb-id';
  process.env.FACEBOOK_APP_SECRET = 'fb-secret';
  process.env.CANVA_CLIENT_ID = 'canva-id';
  process.env.CANVA_CLIENT_SECRET = 'canva-secret';
});

afterEach(() => {
  vi.restoreAllMocks();
  for (const k of [
    'YOUTUBE_OAUTH_CLIENT_ID', 'YOUTUBE_OAUTH_CLIENT_SECRET',
    'TIKTOK_OAUTH_CLIENT_KEY', 'TIKTOK_OAUTH_CLIENT_SECRET',
    'FACEBOOK_APP_ID', 'FACEBOOK_APP_SECRET',
    'CANVA_CLIENT_ID', 'CANVA_CLIENT_SECRET',
  ]) {
    delete process.env[k];
  }
});

// youtube.ts:105 — channel item exists but snippet.title is absent → fallback to item.id
describe('youtube — channel title fallback to item.id', () => {
  it('uses item.id as externalAccountLabel when snippet.title is undefined', async () => {
    const tokenBody = { access_token: 'ya29.x', refresh_token: 'rt', expires_in: 3600, scope: 's' };
    const channelBody = { items: [{ id: 'UC_FALLBACK', snippet: {} }] };

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(tokenBody) } as unknown as Response)
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(channelBody) } as unknown as Response)
    );

    const result = await getOAuthProvider('youtube').exchangeCode({ code: 'c', redirectUri: 'https://example.com' });
    expect(result.externalAccountLabel).toBe('UC_FALLBACK');
  });
});

// tiktok.ts:101 — fetchDisplayName network error → catch block → null label
describe('tiktok — fetchDisplayName network failure', () => {
  it('returns null externalAccountLabel when the profile fetch throws', async () => {
    const tokenBody = {
      access_token: 'tt-access',
      refresh_token: 'tt-refresh',
      expires_in: 86400,
      open_id: 'uid',
      scope: 'video.publish',
    };

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(tokenBody) } as unknown as Response)
        .mockRejectedValueOnce(new Error('network error'))
    );

    const result = await getOAuthProvider('tiktok').exchangeCode({ code: 'c', redirectUri: 'https://example.com' });
    expect(result.externalAccountLabel).toBeNull();
  });
});

// facebook.ts:52 — short-lived token response has no access_token field
describe('facebook — missing short-lived access_token', () => {
  it('throws when the short-lived token response contains no access_token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ token_type: 'bearer' }),
      } as unknown as Response)
    );

    await expect(
      getOAuthProvider('facebook').exchangeCode({ code: 'c', redirectUri: 'https://example.com' })
    ).rejects.toThrow('access_token');
  });
});

// facebook.ts:62 — long-lived exchange responds without access_token
describe('facebook — missing long-lived access_token', () => {
  it('throws when the long-lived token response contains no access_token', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: () => Promise.resolve({ access_token: 'short-lived' }),
        } as unknown as Response)
        .mockResolvedValueOnce({
          ok: true, status: 200,
          json: () => Promise.resolve({ token_type: 'bearer' }),
        } as unknown as Response)
    );

    await expect(
      getOAuthProvider('facebook').exchangeCode({ code: 'c', redirectUri: 'https://example.com' })
    ).rejects.toThrow('long-lived token exchange failed');
  });
});

// canva.ts:104 — profile body has no display_name → returns null
describe('canva — missing display_name in profile', () => {
  it('returns null externalAccountLabel when display_name is absent from profile', async () => {
    const tokenBody = { access_token: 'ca-access', refresh_token: 'ca-rt', expires_in: 1800, scope: 's' };

    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve(tokenBody) } as unknown as Response)
        .mockResolvedValueOnce({ ok: true, status: 200, json: () => Promise.resolve({}) } as unknown as Response)
    );

    const result = await getOAuthProvider('canva').exchangeCode({
      code: 'c', redirectUri: 'https://example.com', codeVerifier: 'v',
    });
    expect(result.externalAccountLabel).toBeNull();
  });
});
