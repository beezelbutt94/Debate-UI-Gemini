import { describe, it, expect, vi, beforeEach } from 'vitest';

// Reset modules before each test so the memoized `configuredProbe` is cleared
beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();
});

describe('platformApiFetch()', () => {
  it('returns { state: "unavailable" } when platform-status reports not configured', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: false, json: async () => ({ configured: false }) })
    );
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/renders/1');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns { state: "unavailable" } when platform-status fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('network error')));
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/renders/1');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns { state: "unavailable" } when configured is false in response body', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: false }) })
    );
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/renders/1');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns { state: "ok", data } when platform is configured and request succeeds', async () => {
    const mockData = { id: 'r1', frames: [] };
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => mockData })
    );
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch<typeof mockData>('/api/v1/renders/1');
    expect(result).toEqual({ state: 'ok', data: mockData });
  });

  it('returns { state: "not_found" } on 404', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) })
      .mockResolvedValueOnce({ ok: false, status: 404 })
    );
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/renders/missing');
    expect(result).toEqual({ state: 'not_found' });
  });

  it('returns { state: "error", message } on non-OK non-404 response', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) })
      .mockResolvedValueOnce({
        ok: false, status: 500,
        json: async () => ({ detail: 'Internal server error' }),
      })
    );
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/renders/1');
    expect(result).toEqual({ state: 'error', message: 'Internal server error' });
  });

  it('returns { state: "error" } with status-code message when no detail in body', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) })
      .mockResolvedValueOnce({
        ok: false, status: 503,
        json: async () => ({}),
      })
    );
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/renders/1');
    expect(result).toMatchObject({ state: 'error', message: expect.stringContaining('503') });
  });

  it('returns { state: "unreachable", message } when fetch throws after platform is configured', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) })
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
    );
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/renders/1');
    expect(result).toEqual({ state: 'unreachable', message: 'ECONNREFUSED' });
  });
});
