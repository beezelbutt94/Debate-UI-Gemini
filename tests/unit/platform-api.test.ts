import { describe, it, expect, vi, beforeEach } from 'vitest';

// platform-api has module-level memoised state (configuredProbe).
// We must re-import the module fresh for each group so tests don't bleed.

async function importFresh() {
  vi.resetModules();
  return import('@/lib/platform-api');
}

describe('platformApiFetch', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
  });

  it('returns { state: "unavailable" } when /api/platform-status says configured: false', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ configured: false }),
      status: 200,
    }));

    const { platformApiFetch } = await importFresh();
    const result = await platformApiFetch('/api/v1/renders/1');
    expect(result.state).toBe('unavailable');
  });

  it('returns { state: "unavailable" } when platform-status fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Network down')));

    const { platformApiFetch } = await importFresh();
    const result = await platformApiFetch('/api/v1/renders/1');
    expect(result.state).toBe('unavailable');
  });

  it('returns { state: "unavailable" } when platform-status returns non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ configured: false }),
      status: 503,
    }));

    const { platformApiFetch } = await importFresh();
    const result = await platformApiFetch('/api/v1/renders/1');
    expect(result.state).toBe('unavailable');
  });

  it('returns { state: "unreachable" } when platform is configured but actual fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn()
      // First call: platform-status → configured: true
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ configured: true }),
        status: 200,
      })
      // Second call: the actual API call throws (e.g., network error)
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
    );

    const { platformApiFetch } = await importFresh();
    const result = await platformApiFetch('/api/v1/renders/1');
    expect(result.state).toBe('unreachable');
    expect((result as { state: 'unreachable'; message: string }).message).toContain('ECONNREFUSED');
  });

  it('returns { state: "not_found" } on 404', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ configured: true }),
        status: 200,
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({ detail: 'Not found' }),
      })
    );

    const { platformApiFetch } = await importFresh();
    const result = await platformApiFetch('/api/v1/renders/nonexistent');
    expect(result.state).toBe('not_found');
  });

  it('returns { state: "error" } on 500 with JSON detail', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ configured: true }),
        status: 200,
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ detail: 'Internal server error' }),
      })
    );

    const { platformApiFetch } = await importFresh();
    const result = await platformApiFetch('/api/v1/renders/1');
    expect(result.state).toBe('error');
    expect((result as { state: 'error'; message: string }).message).toContain('Internal server error');
  });

  it('returns { state: "error" } on 500 with non-JSON body (fallback message)', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ configured: true }),
        status: 200,
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => { throw new Error('Not JSON'); },
      })
    );

    const { platformApiFetch } = await importFresh();
    const result = await platformApiFetch('/api/v1/renders/1');
    expect(result.state).toBe('error');
    expect((result as { state: 'error'; message: string }).message).toContain('500');
  });

  it('returns { state: "ok", data } on 200 with JSON body', async () => {
    const mockData = { id: 'render-1', status: 'complete' };
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ configured: true }),
        status: 200,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockData,
      })
    );

    const { platformApiFetch } = await importFresh();
    const result = await platformApiFetch<{ id: string; status: string }>('/api/v1/renders/1');
    expect(result.state).toBe('ok');
    expect((result as { state: 'ok'; data: typeof mockData }).data).toEqual(mockData);
  });

  it('passes through RequestInit to the actual fetch call', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ configured: true }),
        status: 200,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ result: 'done' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const { platformApiFetch } = await importFresh();
    const init: RequestInit = { method: 'POST', headers: { 'Content-Type': 'application/json' } };
    await platformApiFetch('/api/v1/action', init);

    // Second call (the actual request) should receive the init object
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/action', init);
  });

  it('memoises the platform-status probe within a module instance', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ configured: true }),
        status: 200,
      })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ val: 1 }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const { platformApiFetch } = await importFresh();
    await platformApiFetch('/api/v1/a');
    await platformApiFetch('/api/v1/b');

    // platform-status should only be called once despite two API calls
    const statusCalls = fetchMock.mock.calls.filter(
      (args) => (args[0] as string).includes('platform-status')
    );
    expect(statusCalls.length).toBe(1);
  });
});
