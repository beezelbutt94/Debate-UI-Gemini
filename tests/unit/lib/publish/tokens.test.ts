import { describe, it, expect, vi, afterEach } from 'vitest';

// Mock Supabase admin client
vi.mock('@/lib/supabase/admin', () => ({
  createSupabaseAdminClient: vi.fn(),
}));

// Mock OAuth providers
vi.mock('@/lib/oauth', () => ({
  getOAuthProvider: vi.fn(),
}));

import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { getOAuthProvider } from '@/lib/oauth';
import { getValidAccessToken } from '@/lib/publish/tokens';

const mockCreateAdmin = vi.mocked(createSupabaseAdminClient);
const mockGetOAuthProvider = vi.mocked(getOAuthProvider);

afterEach(() => {
  vi.resetAllMocks();
});

function makeAdminRpc(data: unknown, error: unknown = null) {
  const rpcFn = vi.fn().mockReturnValue({
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  });
  mockCreateAdmin.mockReturnValue({ rpc: rpcFn } as unknown as ReturnType<typeof createSupabaseAdminClient>);
  return rpcFn;
}

describe('getValidAccessToken', () => {
  it('returns null when rpc returns an error', async () => {
    makeAdminRpc(null, { message: 'db error' });
    const result = await getValidAccessToken('user-1', 'tiktok');
    expect(result).toBeNull();
  });

  it('returns null when no data returned', async () => {
    makeAdminRpc(null);
    const result = await getValidAccessToken('user-1', 'youtube');
    expect(result).toBeNull();
  });

  it('returns null when data has no access_token', async () => {
    makeAdminRpc({ access_token: null, refresh_token: null, expires_at: null, external_account_id: null });
    const result = await getValidAccessToken('user-1', 'facebook');
    expect(result).toBeNull();
  });

  it('returns valid token when not expired', async () => {
    const future = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min from now
    makeAdminRpc({
      access_token: 'valid-at',
      refresh_token: 'rt',
      expires_at: future,
      external_account_id: 'ext-id',
    });
    const result = await getValidAccessToken('user-1', 'tiktok');
    expect(result).not.toBeNull();
    expect(result!.accessToken).toBe('valid-at');
    expect(result!.externalAccountId).toBe('ext-id');
  });

  it('returns token when expires_at is null (non-expiring token)', async () => {
    makeAdminRpc({
      access_token: 'permanent-at',
      refresh_token: null,
      expires_at: null,
      external_account_id: 'page-id',
    });
    const result = await getValidAccessToken('user-1', 'facebook');
    expect(result).not.toBeNull();
    expect(result!.accessToken).toBe('permanent-at');
  });

  it('returns token without refreshing when expired but no refresh_token', async () => {
    const past = new Date(Date.now() - 1000).toISOString();
    makeAdminRpc({
      access_token: 'expired-at',
      refresh_token: null,
      expires_at: past,
      external_account_id: null,
    });
    const result = await getValidAccessToken('user-1', 'tiktok');
    // No refresh token means we return the existing (expired) access token as-is
    expect(result).not.toBeNull();
    expect(result!.accessToken).toBe('expired-at');
  });

  it('refreshes token when expiring within 60 seconds', async () => {
    const expiringSoon = new Date(Date.now() + 30 * 1000).toISOString(); // 30s from now
    const storeMock = vi.fn().mockResolvedValue({ error: null });
    const rpcFn = vi.fn()
      .mockReturnValueOnce({ maybeSingle: vi.fn().mockResolvedValue({
        data: {
          access_token: 'old-at',
          refresh_token: 'old-rt',
          expires_at: expiringSoon,
          external_account_id: 'ext-123',
        },
        error: null,
      })})
      .mockReturnValue({ error: null }); // second rpc call (store_platform_connection)
    // The store call returns a thenable
    const rpcChain = vi.fn()
      .mockReturnValueOnce({ maybeSingle: vi.fn().mockResolvedValue({
        data: {
          access_token: 'old-at',
          refresh_token: 'old-rt',
          expires_at: expiringSoon,
          external_account_id: 'ext-123',
        },
        error: null,
      })})
      .mockResolvedValueOnce({ error: null }); // store_platform_connection

    mockCreateAdmin.mockReturnValue({ rpc: rpcChain } as unknown as ReturnType<typeof createSupabaseAdminClient>);

    mockGetOAuthProvider.mockReturnValue({
      requiresPkce: false,
      authorizationUrl: vi.fn(),
      exchangeCode: vi.fn(),
      refreshAccessToken: vi.fn().mockResolvedValue({
        accessToken: 'refreshed-at',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        refreshToken: null,
      }),
    });

    const result = await getValidAccessToken('user-1', 'youtube');
    expect(result).not.toBeNull();
    expect(result!.accessToken).toBe('refreshed-at');
  });

  it('calls store_platform_connection after refreshing', async () => {
    const expiringSoon = new Date(Date.now() + 30 * 1000).toISOString();
    const rpcChain = vi.fn()
      .mockReturnValueOnce({ maybeSingle: vi.fn().mockResolvedValue({
        data: {
          access_token: 'old-at',
          refresh_token: 'old-rt',
          expires_at: expiringSoon,
          external_account_id: 'ext-999',
        },
        error: null,
      })})
      .mockResolvedValueOnce({ error: null });

    mockCreateAdmin.mockReturnValue({ rpc: rpcChain } as unknown as ReturnType<typeof createSupabaseAdminClient>);

    mockGetOAuthProvider.mockReturnValue({
      requiresPkce: false,
      authorizationUrl: vi.fn(),
      exchangeCode: vi.fn(),
      refreshAccessToken: vi.fn().mockResolvedValue({
        accessToken: 'new-at',
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
        refreshToken: 'new-rt',
      }),
    });

    await getValidAccessToken('user-1', 'tiktok');
    // second rpc call should be store_platform_connection
    expect(rpcChain).toHaveBeenCalledWith('store_platform_connection', expect.objectContaining({
      p_access_token: 'new-at',
      p_refresh_token: 'new-rt',
    }));
  });
});
