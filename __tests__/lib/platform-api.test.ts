import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to reset modules so that the memoised `configuredProbe` variable
// inside lib/platform-api starts fresh for each test.

describe('platformApiFetch', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function load() {
    const mod = await import('@/lib/platform-api');
    return mod.platformApiFetch;
  }

  it('returns { state: "unavailable" } when /api/platform-status says not configured', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ configured: false }),
    } as Response));

    const platformApiFetch = await load();
    const result = await platformApiFetch('/api/v1/some-path');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns { state: "unavailable" } when /api/platform-status returns non-ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    } as Response));

    const platformApiFetch = await load();
    const result = await platformApiFetch('/api/v1/some-path');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns { state: "unavailable" } when /api/platform-status fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Network error')));

    const platformApiFetch = await load();
    const result = await platformApiFetch('/api/v1/some-path');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns { state: "ok", data } when backend responds 200 with JSON', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ configured: true }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'abc', name: 'Test' }),
      } as Response));

    const platformApiFetch = await load();
    const result = await platformApiFetch<{ id: string; name: string }>('/api/v1/renders/abc');
    expect(result).toEqual({ state: 'ok', data: { id: 'abc', name: 'Test' } });
  });

  it('returns { state: "not_found" } for 404 response', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ configured: true }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({}),
      } as Response));

    const platformApiFetch = await load();
    const result = await platformApiFetch('/api/v1/renders/missing');
    expect(result).toEqual({ state: 'not_found' });
  });

  it('returns { state: "error" } with parsed detail for non-ok, non-404 response', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ configured: true }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ detail: 'Internal server error from backend' }),
      } as Response));

    const platformApiFetch = await load();
    const result = await platformApiFetch('/api/v1/renders/bad');
    expect(result).toEqual({ state: 'error', message: 'Internal server error from backend' });
  });

  it('returns { state: "error" } with status fallback when body has no detail', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ configured: true }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({}),
      } as Response));

    const platformApiFetch = await load();
    const result = await platformApiFetch('/api/v1/renders/bad');
    expect(result).toEqual({ state: 'error', message: 'Request failed (503)' });
  });

  it('returns { state: "unreachable" } when actual API fetch throws after configured=true', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ configured: true }),
      } as Response)
      .mockRejectedValueOnce(new Error('ECONNREFUSED')));

    const platformApiFetch = await load();
    const result = await platformApiFetch('/api/v1/renders/bad');
    expect(result).toEqual({ state: 'unreachable', message: 'ECONNREFUSED' });
  });
});
