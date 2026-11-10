/**
 * Tests for getValidAccessToken() in lib/publish/tokens.ts.
 * Kept in its own file so vi.mock('@/lib/publish/tokens') in publish.test.ts
 * does not shadow the real implementation here.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock('@/lib/oauth', async () => {
  const actual = await vi.importActual('@/lib/oauth');
  return { ...actual, getOAuthProvider: vi.fn() };
});

function makeAdminRpc(rpcResult: { data: unknown; error: unknown }) {
  return vi.fn().mockReturnValue({
    maybeSingle: vi.fn().mockResolvedValue(rpcResult),
  });
}

describe('getValidAccessToken()', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when RPC returns an error', async () => {
    const { createSupabaseAdminClient } = await import('@/lib/supabase/admin');
    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      rpc: makeAdminRpc({ data: null, error: { message: 'DB error' } }),
    } as any);

    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    expect(await getValidAccessToken('u1', 'tiktok')).toBeNull();
  });

  it('returns null when no connection data exists', async () => {
    const { createSupabaseAdminClient } = await import('@/lib/supabase/admin');
    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      rpc: makeAdminRpc({ data: null, error: null }),
    } as any);

    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    expect(await getValidAccessToken('u1', 'tiktok')).toBeNull();
  });

  it('returns null when access_token is null', async () => {
    const { createSupabaseAdminClient } = await import('@/lib/supabase/admin');
    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      rpc: makeAdminRpc({
        data: { access_token: null, refresh_token: null, expires_at: null, external_account_id: null },
        error: null,
      }),
    } as any);

    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    expect(await getValidAccessToken('u1', 'tiktok')).toBeNull();
  });

  it('returns valid token directly when not expired', async () => {
    const { createSupabaseAdminClient } = await import('@/lib/supabase/admin');
    const futureTime = new Date(Date.now() + 3_600_000).toISOString();
    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      rpc: makeAdminRpc({
        data: { access_token: 'valid-at', refresh_token: 'rt', expires_at: futureTime, external_account_id: 'ext-id' },
        error: null,
      }),
    } as any);

    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    const result = await getValidAccessToken('u1', 'tiktok');
    expect(result?.accessToken).toBe('valid-at');
    expect(result?.externalAccountId).toBe('ext-id');
  });

  it('returns token directly when expires_at is null (never expires)', async () => {
    const { createSupabaseAdminClient } = await import('@/lib/supabase/admin');
    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      rpc: makeAdminRpc({
        data: { access_token: 'no-expiry-at', refresh_token: 'rt', expires_at: null, external_account_id: null },
        error: null,
      }),
    } as any);

    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    const result = await getValidAccessToken('u1', 'facebook');
    expect(result?.accessToken).toBe('no-expiry-at');
  });

  it('returns current token when expired but no refresh_token available', async () => {
    const { createSupabaseAdminClient } = await import('@/lib/supabase/admin');
    const pastTime = new Date(Date.now() - 1000).toISOString();
    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      rpc: makeAdminRpc({
        data: { access_token: 'old-at', refresh_token: null, expires_at: pastTime, external_account_id: 'ext-id' },
        error: null,
      }),
    } as any);

    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    const result = await getValidAccessToken('u1', 'youtube');
    expect(result?.accessToken).toBe('old-at');
  });

  it('refreshes and stores token when expired and refresh_token available', async () => {
    const { createSupabaseAdminClient } = await import('@/lib/supabase/admin');
    const { getOAuthProvider } = await import('@/lib/oauth');

    const pastTime = new Date(Date.now() - 1000).toISOString();
    const storeRpc = vi.fn().mockReturnValue({ error: null });

    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      rpc: vi.fn()
        .mockReturnValueOnce({
          maybeSingle: vi.fn().mockResolvedValue({
            data: { access_token: 'expired-at', refresh_token: 'rt', expires_at: pastTime, external_account_id: 'ext-id' },
            error: null,
          }),
        })
        .mockImplementationOnce(() => storeRpc()),
    } as any);

    vi.mocked(getOAuthProvider).mockReturnValue({
      requiresPkce: false,
      authorizationUrl: vi.fn(),
      exchangeCode: vi.fn(),
      refreshAccessToken: vi.fn().mockResolvedValue({
        accessToken: 'new-at',
        expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
        refreshToken: 'new-rt',
      }),
    });

    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    const result = await getValidAccessToken('u1', 'tiktok');
    expect(result?.accessToken).toBe('new-at');
    expect(result?.externalAccountId).toBe('ext-id');
  });
});
