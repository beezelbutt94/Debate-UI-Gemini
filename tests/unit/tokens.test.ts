/**
 * Tests for lib/publish/tokens.ts — getValidAccessToken().
 * Mocks Supabase admin client and the OAuth provider registry.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock('@/lib/oauth/index', () => ({
  getOAuthProvider: vi.fn(),
}));

function makeAdminWithRpc(data: unknown, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const rpc = vi.fn().mockReturnValue({ maybeSingle });
  return { rpc };
}

describe('getValidAccessToken()', () => {
  beforeEach(async () => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when RPC errors out', async () => {
    const { createSupabaseAdminClient } = await import('@/lib/supabase/admin');
    const admin = makeAdminWithRpc(null, { message: 'permission denied' });
    (createSupabaseAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(admin);

    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    const result = await getValidAccessToken('user-1', 'youtube');
    expect(result).toBeNull();
  });

  it('returns null when data is null (no connection)', async () => {
    const { createSupabaseAdminClient } = await import('@/lib/supabase/admin');
    const admin = makeAdminWithRpc(null);
    (createSupabaseAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(admin);

    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    const result = await getValidAccessToken('user-1', 'youtube');
    expect(result).toBeNull();
  });

  it('returns null when access_token field is null', async () => {
    const { createSupabaseAdminClient } = await import('@/lib/supabase/admin');
    const admin = makeAdminWithRpc({
      access_token: null,
      refresh_token: null,
      expires_at: null,
      external_account_id: null,
    });
    (createSupabaseAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(admin);

    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    const result = await getValidAccessToken('user-1', 'youtube');
    expect(result).toBeNull();
  });

  it('returns token directly when token is not near expiry', async () => {
    const { createSupabaseAdminClient } = await import('@/lib/supabase/admin');
    const futureExpiry = new Date(Date.now() + 3_600_000).toISOString();
    const admin = makeAdminWithRpc({
      access_token: 'valid-token',
      refresh_token: 'rt',
      expires_at: futureExpiry,
      external_account_id: 'ext-id',
    });
    (createSupabaseAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(admin);

    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    const result = await getValidAccessToken('user-1', 'youtube');
    expect(result).toEqual({ accessToken: 'valid-token', externalAccountId: 'ext-id' });
  });

  it('returns token when expires_at is null (non-expiring token)', async () => {
    const { createSupabaseAdminClient } = await import('@/lib/supabase/admin');
    const admin = makeAdminWithRpc({
      access_token: 'valid-token',
      refresh_token: null,
      expires_at: null,
      external_account_id: null,
    });
    (createSupabaseAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(admin);

    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    const result = await getValidAccessToken('user-1', 'facebook');
    expect(result).toEqual({ accessToken: 'valid-token', externalAccountId: null });
  });

  it('returns token directly when expiring but no refresh token available', async () => {
    const { createSupabaseAdminClient } = await import('@/lib/supabase/admin');
    const pastExpiry = new Date(Date.now() - 1000).toISOString();
    const admin = makeAdminWithRpc({
      access_token: 'almost-expired',
      refresh_token: null,
      expires_at: pastExpiry,
      external_account_id: 'ext-id',
    });
    (createSupabaseAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(admin);

    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    const result = await getValidAccessToken('user-1', 'youtube');
    expect(result).toEqual({ accessToken: 'almost-expired', externalAccountId: 'ext-id' });
  });

  it('refreshes and returns new token when expiring and a refresh token exists', async () => {
    const { createSupabaseAdminClient } = await import('@/lib/supabase/admin');
    const { getOAuthProvider } = await import('@/lib/oauth/index');

    const pastExpiry = new Date(Date.now() - 1000).toISOString();
    const futureExpiry = new Date(Date.now() + 3_600_000).toISOString();

    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        access_token: 'old-token',
        refresh_token: 'old-refresh',
        expires_at: pastExpiry,
        external_account_id: 'ext-id',
      },
      error: null,
    });
    const rpc = vi.fn().mockReturnValue({ maybeSingle });
    (createSupabaseAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({ rpc });

    const mockProvider = {
      refreshAccessToken: vi.fn().mockResolvedValue({
        accessToken: 'new-token',
        expiresAt: futureExpiry,
        refreshToken: null,
      }),
    };
    (getOAuthProvider as ReturnType<typeof vi.fn>).mockReturnValue(mockProvider);

    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    const result = await getValidAccessToken('user-1', 'youtube');

    expect(result?.accessToken).toBe('new-token');
    expect(result?.externalAccountId).toBe('ext-id');
    expect(mockProvider.refreshAccessToken).toHaveBeenCalledWith('old-refresh');
  });

  it('persists the refreshed token back to Supabase after refresh', async () => {
    const { createSupabaseAdminClient } = await import('@/lib/supabase/admin');
    const { getOAuthProvider } = await import('@/lib/oauth/index');

    const pastExpiry = new Date(Date.now() - 1000).toISOString();
    const futureExpiry = new Date(Date.now() + 3_600_000).toISOString();

    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        access_token: 'old',
        refresh_token: 'old-rt',
        expires_at: pastExpiry,
        external_account_id: 'eid',
      },
      error: null,
    });
    const rpc = vi.fn().mockReturnValue({ maybeSingle });
    (createSupabaseAdminClient as ReturnType<typeof vi.fn>).mockReturnValue({ rpc });

    (getOAuthProvider as ReturnType<typeof vi.fn>).mockReturnValue({
      refreshAccessToken: vi.fn().mockResolvedValue({
        accessToken: 'refreshed',
        expiresAt: futureExpiry,
        refreshToken: 'new-rt',
      }),
    });

    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    await getValidAccessToken('user-1', 'youtube');

    // Should have been called twice: once for RPC read, once for store
    expect(rpc).toHaveBeenCalledTimes(2);
    const storeCall = rpc.mock.calls[1];
    expect(storeCall[0]).toBe('store_platform_connection');
    expect(storeCall[1]).toMatchObject({
      p_access_token: 'refreshed',
      p_refresh_token: 'new-rt',
    });
  });
});
