import { describe, it, expect, vi, beforeEach } from 'vitest';

// platform-api.ts memoizes the probe in a module-level variable.
// We must re-import the module fresh for each test group that needs a
// different probe outcome, using vi.resetModules() + dynamic import.

type PlatformApiResult<T> =
  | { state: 'ok'; data: T }
  | { state: 'unavailable' }
  | { state: 'unreachable'; message: string }
  | { state: 'not_found' }
  | { state: 'error'; message: string };

async function freshModule() {
  vi.resetModules();
  const mod = await import('@/lib/platform-api');
  return mod;
}

describe('platformApiFetch — unavailable (platform not configured)', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ configured: false }),
    }));
  });

  it('returns state=unavailable when probe returns configured:false', async () => {
    const { platformApiFetch } = await freshModule();
    const result = await platformApiFetch('/api/v1/renders/123');
    expect(result.state).toBe('unavailable');
  });

  it('never hits the actual path when unavailable', async () => {
    const { platformApiFetch } = await freshModule();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ configured: false }),
    });
    vi.stubGlobal('fetch', fetchMock);
    await platformApiFetch('/api/v1/renders/123');
    // fetch is only called once — for the probe, not the actual path
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/platform-status');
  });
});

describe('platformApiFetch — unavailable when probe network fails', () => {
  it('returns state=unavailable when the probe fetch itself throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const { platformApiFetch } = await freshModule();
    const result = await platformApiFetch('/api/v1/renders/999');
    expect(result.state).toBe('unavailable');
  });
});

describe('platformApiFetch — unavailable when probe returns non-ok', () => {
  it('returns state=unavailable when probe response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ configured: false }),
    }));
    const { platformApiFetch } = await freshModule();
    const result = await platformApiFetch('/api/v1/renders/999');
    expect(result.state).toBe('unavailable');
  });
});

describe('platformApiFetch — configured platform', () => {
  // For configured tests, the probe must return configured:true,
  // and subsequent calls go to the real path.
  function setupFetch(pathResponses: Map<string, () => Response | Promise<Response>>) {
    return vi.fn().mockImplementation(async (url: string) => {
      const handler = pathResponses.get(url);
      if (handler) return handler();
      throw new Error(`Unexpected fetch call to ${url}`);
    });
  }

  it('returns state=ok with parsed data for a successful response', async () => {
    const data = { id: '123', title: 'My Render' };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) }) // probe
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => data }); // real call
    vi.stubGlobal('fetch', fetchMock);
    const { platformApiFetch } = await freshModule();
    const result = await platformApiFetch<typeof data>('/api/v1/renders/123');
    expect(result.state).toBe('ok');
    if (result.state === 'ok') {
      expect(result.data).toEqual(data);
    }
  });

  it('returns state=not_found for a 404', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) })
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    const { platformApiFetch } = await freshModule();
    const result = await platformApiFetch('/api/v1/renders/does-not-exist');
    expect(result.state).toBe('not_found');
  });

  it('returns state=error with detail message for a 422', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) })
      .mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ detail: 'Validation failed: missing field' }),
      });
    vi.stubGlobal('fetch', fetchMock);
    const { platformApiFetch } = await freshModule();
    const result = await platformApiFetch('/api/v1/renders/bad');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toContain('Validation failed: missing field');
    }
  });

  it('returns state=error with status code when body has no detail', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => { throw new Error('not JSON'); },
      });
    vi.stubGlobal('fetch', fetchMock);
    const { platformApiFetch } = await freshModule();
    const result = await platformApiFetch('/api/v1/renders/fail');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toContain('500');
    }
  });

  it('returns state=unreachable when configured but fetch throws', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) })
      .mockRejectedValueOnce(new Error('ECONNREFUSED'));
    vi.stubGlobal('fetch', fetchMock);
    const { platformApiFetch } = await freshModule();
    const result = await platformApiFetch('/api/v1/renders/xyz');
    expect(result.state).toBe('unreachable');
    if (result.state === 'unreachable') {
      expect(result.message).toContain('ECONNREFUSED');
    }
  });

  it('passes init options (method, headers, body) to fetch', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ done: true }) });
    vi.stubGlobal('fetch', fetchMock);
    const { platformApiFetch } = await freshModule();
    await platformApiFetch('/api/v1/action', { method: 'POST', body: JSON.stringify({ x: 1 }) });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/v1/action', { method: 'POST', body: JSON.stringify({ x: 1 }) });
  });

  it('memoizes the probe: only calls /api/platform-status once across multiple requests', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) }) // probe (once)
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({}) }); // all subsequent calls
    vi.stubGlobal('fetch', fetchMock);
    const { platformApiFetch } = await freshModule();
    await platformApiFetch('/api/v1/a');
    await platformApiFetch('/api/v1/b');
    await platformApiFetch('/api/v1/c');
    const probeCalls = fetchMock.mock.calls.filter(([url]: [string]) => url === '/api/platform-status');
    expect(probeCalls).toHaveLength(1);
  });
});
