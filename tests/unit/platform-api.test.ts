import { describe, it, expect, vi, beforeEach } from 'vitest';

// platformApiFetch has module-level memoized state for the probe, so we must
// reset modules between tests that need different probe responses.

describe('platformApiFetch()', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  async function load() {
    const mod = await import('@/lib/platform-api');
    return mod.platformApiFetch;
  }

  it('returns { state: "unavailable" } when platform-status says configured=false', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ configured: false }),
    }));
    const platformApiFetch = await load();
    const result = await platformApiFetch('/api/v1/some-resource');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns { state: "unavailable" } when platform-status fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Network error')));
    const platformApiFetch = await load();
    const result = await platformApiFetch('/api/v1/some-resource');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns { state: "unavailable" } when platform-status returns non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    }));
    const platformApiFetch = await load();
    const result = await platformApiFetch('/api/v1/some-resource');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns { state: "ok", data } on successful request when platform is configured', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) }) // probe
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: 42 }) }); // resource
    vi.stubGlobal('fetch', mockFetch);
    const platformApiFetch = await load();
    const result = await platformApiFetch<{ id: number }>('/api/v1/resource');
    expect(result).toEqual({ state: 'ok', data: { id: 42 } });
  });

  it('returns { state: "not_found" } on 404 when platform is configured', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) })
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });
    vi.stubGlobal('fetch', mockFetch);
    const platformApiFetch = await load();
    const result = await platformApiFetch('/api/v1/missing');
    expect(result).toEqual({ state: 'not_found' });
  });

  it('returns { state: "error", message } on non-404 error when platform is configured', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ detail: 'Internal server error' }),
      });
    vi.stubGlobal('fetch', mockFetch);
    const platformApiFetch = await load();
    const result = await platformApiFetch('/api/v1/failing');
    expect(result).toEqual({ state: 'error', message: 'Internal server error' });
  });

  it('falls back to status-code message when error body has no detail field', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ something_else: 'data' }),
      });
    vi.stubGlobal('fetch', mockFetch);
    const platformApiFetch = await load();
    const result = await platformApiFetch('/api/v1/unavailable');
    expect(result).toEqual({ state: 'error', message: 'Request failed (503)' });
  });

  it('falls back to status-code message when error body is non-JSON', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) })
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => { throw new SyntaxError('not json'); },
      });
    vi.stubGlobal('fetch', mockFetch);
    const platformApiFetch = await load();
    const result = await platformApiFetch('/api/v1/bad-gateway');
    expect(result).toEqual({ state: 'error', message: 'Request failed (502)' });
  });

  it('returns { state: "unreachable", message } when configured but fetch throws', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) })
      .mockRejectedValueOnce(new Error('Connection refused'));
    vi.stubGlobal('fetch', mockFetch);
    const platformApiFetch = await load();
    const result = await platformApiFetch('/api/v1/resource');
    expect(result).toEqual({ state: 'unreachable', message: 'Connection refused' });
  });

  it('memoizes the probe — only calls /api/platform-status once for multiple requests', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) }) // probe (once)
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }); // resources
    vi.stubGlobal('fetch', mockFetch);
    const platformApiFetch = await load();
    await platformApiFetch('/api/v1/a');
    await platformApiFetch('/api/v1/b');
    await platformApiFetch('/api/v1/c');
    // probe called once, then 3 resource calls = 4 total
    expect(mockFetch).toHaveBeenCalledTimes(4);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/platform-status');
    expect(mockFetch.mock.calls[1][0]).toBe('/api/v1/a');
    expect(mockFetch.mock.calls[2][0]).toBe('/api/v1/b');
    expect(mockFetch.mock.calls[3][0]).toBe('/api/v1/c');
  });
});
