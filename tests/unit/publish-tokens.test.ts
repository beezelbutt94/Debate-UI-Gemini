/**
 * Tests for lib/publish/tokens.ts (getValidAccessToken).
 *
 * Both Supabase admin client and the OAuth provider are fully mocked,
 * so these tests exercise only the token-refresh orchestration logic.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Types matching ConnectionSecretsRow ────────────────────────────────────

interface ConnectionSecretsRow {
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  external_account_id: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeSupabaseMock(
  row: ConnectionSecretsRow | null,
  error: { message: string } | null = null
) {
  const rpcMock = vi.fn().mockReturnValue({
    maybeSingle: () => Promise.resolve({ data: row, error }),
  });
  return { rpc: rpcMock };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('getValidAccessToken', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  // ── No connection at all ─────────────────────────────────────────────────

  it('returns null when the RPC returns no data', async () => {
    vi.doMock('@/lib/supabase/admin', () => ({
      createSupabaseAdminClient: () => makeSupabaseMock(null),
    }));
    vi.doMock('@/lib/oauth', () => ({ getOAuthProvider: vi.fn() }));

    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    const result = await getValidAccessToken('user-1', 'youtube');
    expect(result).toBeNull();
  });

  it('returns null when the row has no access_token', async () => {
    vi.doMock('@/lib/supabase/admin', () => ({
      createSupabaseAdminClient: () =>
        makeSupabaseMock({ access_token: null, refresh_token: null, expires_at: null, external_account_id: null }),
    }));
    vi.doMock('@/lib/oauth', () => ({ getOAuthProvider: vi.fn() }));

    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    const result = await getValidAccessToken('user-1', 'youtube');
    expect(result).toBeNull();
  });

  it('returns null when the RPC returns an error', async () => {
    vi.doMock('@/lib/supabase/admin', () => ({
      createSupabaseAdminClient: () => makeSupabaseMock(null, { message: 'permission denied' }),
    }));
    vi.doMock('@/lib/oauth', () => ({ getOAuthProvider: vi.fn() }));

    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    const result = await getValidAccessToken('user-1', 'facebook');
    expect(result).toBeNull();
  });

  // ── Valid, non-expiring token ────────────────────────────────────────────

  it('returns the existing token when it is not expiring', async () => {
    const futureExpiry = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour from now
    vi.doMock('@/lib/supabase/admin', () => ({
      createSupabaseAdminClient: () =>
        makeSupabaseMock({
          access_token: 'valid-token',
          refresh_token: 'ref-token',
          expires_at: futureExpiry,
          external_account_id: 'ext-123',
        }),
    }));
    vi.doMock('@/lib/oauth', () => ({ getOAuthProvider: vi.fn() }));

    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    const result = await getValidAccessToken('user-1', 'youtube');
    expect(result).toEqual({ accessToken: 'valid-token', externalAccountId: 'ext-123' });
  });

  it('returns the existing token when expires_at is null (non-expiring)', async () => {
    vi.doMock('@/lib/supabase/admin', () => ({
      createSupabaseAdminClient: () =>
        makeSupabaseMock({
          access_token: 'static-token',
          refresh_token: null,
          expires_at: null,
          external_account_id: null,
        }),
    }));
    vi.doMock('@/lib/oauth', () => ({ getOAuthProvider: vi.fn() }));

    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    const result = await getValidAccessToken('user-1', 'facebook');
    expect(result).toEqual({ accessToken: 'static-token', externalAccountId: null });
  });

  // ── Token is expiring — no refresh_token available ────────────────────────

  it('returns the existing token without refreshing when expires_at is soon but refresh_token is null', async () => {
    const soonExpiry = new Date(Date.now() + 30_000).toISOString(); // 30s from now → within 60s window
    vi.doMock('@/lib/supabase/admin', () => ({
      createSupabaseAdminClient: () =>
        makeSupabaseMock({
          access_token: 'expiring-token',
          refresh_token: null, // no refresh token → can't refresh
          expires_at: soonExpiry,
          external_account_id: 'ext-abc',
        }),
    }));
    const mockRefresh = vi.fn();
    vi.doMock('@/lib/oauth', () => ({
      getOAuthProvider: () => ({ refreshAccessToken: mockRefresh }),
    }));

    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    const result = await getValidAccessToken('user-1', 'tiktok');
    expect(result).toEqual({ accessToken: 'expiring-token', externalAccountId: 'ext-abc' });
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  // ── Token is expiring — refresh succeeds ────────────────────────────────

  it('refreshes and stores the new token when expiring with a refresh_token available', async () => {
    const soonExpiry = new Date(Date.now() + 30_000).toISOString();

    const storeMock = vi.fn().mockResolvedValue({ error: null });
    const adminMock = {
      rpc: vi.fn()
        .mockReturnValueOnce({ maybeSingle: () => Promise.resolve({ data: {
          access_token: 'old-access',
          refresh_token: 'ref-token',
          expires_at: soonExpiry,
          external_account_id: 'ext-abc',
        }, error: null }) })
        .mockReturnValue(Promise.resolve({ error: null })), // store call
    };
    // The second rpc call (store) doesn't need maybeSingle
    // Re-wire: first call is get_platform_connection_secrets, second is store_platform_connection
    let rpcCallCount = 0;
    adminMock.rpc = vi.fn().mockImplementation(() => {
      rpcCallCount++;
      if (rpcCallCount === 1) {
        return { maybeSingle: () => Promise.resolve({ data: {
          access_token: 'old-access',
          refresh_token: 'ref-token',
          expires_at: soonExpiry,
          external_account_id: 'ext-abc',
        }, error: null }) };
      }
      return Promise.resolve({ error: null }); // store call
    });

    vi.doMock('@/lib/supabase/admin', () => ({
      createSupabaseAdminClient: () => adminMock,
    }));

    const mockRefreshAccessToken = vi.fn().mockResolvedValue({
      accessToken: 'refreshed-access',
      refreshToken: 'new-ref-token',
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    });
    vi.doMock('@/lib/oauth', () => ({
      getOAuthProvider: () => ({ refreshAccessToken: mockRefreshAccessToken }),
    }));

    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    const result = await getValidAccessToken('user-1', 'youtube');

    expect(result).toEqual({ accessToken: 'refreshed-access', externalAccountId: 'ext-abc' });
    expect(mockRefreshAccessToken).toHaveBeenCalledWith('ref-token');
    // Store was called to persist the new token
    expect(rpcCallCount).toBe(2);
  });

  it('uses existing refresh_token when provider does not rotate it', async () => {
    const soonExpiry = new Date(Date.now() + 30_000).toISOString();

    let rpcCallCount = 0;
    const capturedStoreArgs: unknown[] = [];
    const adminMock = {
      rpc: vi.fn().mockImplementation((name: string, args: unknown) => {
        rpcCallCount++;
        if (rpcCallCount === 1) {
          return { maybeSingle: () => Promise.resolve({ data: {
            access_token: 'old-access',
            refresh_token: 'original-ref',
            expires_at: soonExpiry,
            external_account_id: 'ext-id',
          }, error: null }) };
        }
        capturedStoreArgs.push(args);
        return Promise.resolve({ error: null });
      }),
    };

    vi.doMock('@/lib/supabase/admin', () => ({
      createSupabaseAdminClient: () => adminMock,
    }));

    vi.doMock('@/lib/oauth', () => ({
      getOAuthProvider: () => ({
        refreshAccessToken: vi.fn().mockResolvedValue({
          accessToken: 'new-access',
          expiresAt: new Date(Date.now() + 3600_000).toISOString(),
          refreshToken: null, // provider did not rotate
        }),
      }),
    }));

    const { getValidAccessToken } = await import('@/lib/publish/tokens');
    const result = await getValidAccessToken('user-1', 'tiktok');
    expect(result?.accessToken).toBe('new-access');

    // The store call should have used the original refresh token (not null)
    const storeArgs = capturedStoreArgs[0] as Record<string, unknown>;
    expect(storeArgs.p_refresh_token).toBe('original-ref');
  });
});
