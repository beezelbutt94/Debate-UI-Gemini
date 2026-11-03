/**
 * Tests for platformApiFetch.
 *
 * platformApiFetch memoises the platform-status probe in a module-level
 * variable (`configuredProbe`). We reset the module before each test so each
 * test starts with a fresh cache, then provide a fresh `fetch` mock whose
 * first call handles /api/platform-status and (if the platform is
 * "configured") whose second call handles the actual API request.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

function makeFetchMock(...responses: Array<{ ok: boolean; status?: number; json?: () => Promise<unknown>; headers?: Headers }>) {
  const fns = responses.map((r) =>
    vi.fn().mockResolvedValueOnce({
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 500),
      headers: r.headers ?? new Headers(),
      json: r.json ?? (async () => ({})),
      text: async () => '',
    })
  );
  let idx = 0;
  return vi.fn(() => fns[idx++]?.() ?? Promise.reject(new Error('unexpected fetch call')));
}

describe('platformApiFetch()', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns { state: "unavailable" } when platform-status says not configured', async () => {
    vi.stubGlobal('fetch', makeFetchMock({
      ok: true,
      json: async () => ({ configured: false }),
    }));
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/something');
    expect(result.state).toBe('unavailable');
  });

  it('returns { state: "unavailable" } when platform-status returns non-ok', async () => {
    vi.stubGlobal('fetch', makeFetchMock({ ok: false, status: 503 }));
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/something');
    expect(result.state).toBe('unavailable');
  });

  it('returns { state: "unavailable" } when platform-status fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('network error')));
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/something');
    expect(result.state).toBe('unavailable');
  });

  it('returns { state: "unreachable" } when platform IS configured but actual fetch throws', async () => {
    const mock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => ({ configured: true }),
        text: async () => '',
      })
      .mockRejectedValueOnce(new Error('connection refused'));
    vi.stubGlobal('fetch', mock);
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/something');
    expect(result.state).toBe('unreachable');
    if (result.state === 'unreachable') {
      expect(result.message).toContain('connection refused');
    }
  });

  it('returns { state: "not_found" } for a 404 from the configured platform', async () => {
    const mock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => ({ configured: true }),
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        headers: new Headers(),
        json: async () => ({}),
        text: async () => '',
      });
    vi.stubGlobal('fetch', mock);
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/renders/no-such-id');
    expect(result.state).toBe('not_found');
  });

  it('returns { state: "error" } for a non-404 failure', async () => {
    const mock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => ({ configured: true }),
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        headers: new Headers(),
        json: async () => ({}),
        text: async () => '',
      });
    vi.stubGlobal('fetch', mock);
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/something');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toContain('500');
    }
  });

  it('surfaces the "detail" field from a JSON error body', async () => {
    const mock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => ({ configured: true }),
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 422,
        headers: new Headers(),
        json: async () => ({ detail: 'Validation error: bad field' }),
        text: async () => '',
      });
    vi.stubGlobal('fetch', mock);
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/generate');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toBe('Validation error: bad field');
    }
  });

  it('returns { state: "ok", data } on a successful response', async () => {
    const responseData = { render_id: 'abc123', status: 'complete' };
    const mock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => ({ configured: true }),
        text: async () => '',
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => responseData,
        text: async () => '',
      });
    vi.stubGlobal('fetch', mock);
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch<{ render_id: string; status: string }>('/api/v1/renders/abc123');
    expect(result.state).toBe('ok');
    if (result.state === 'ok') {
      expect(result.data).toEqual(responseData);
    }
  });

  it('memoises the probe so platform-status is only called once across multiple requests', async () => {
    const responseData = { value: 1 };
    const mock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        headers: new Headers(),
        json: async () => ({ configured: true }),
        text: async () => '',
      })
      .mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: async () => responseData,
        text: async () => '',
      });
    vi.stubGlobal('fetch', mock);
    const { platformApiFetch } = await import('@/lib/platform-api');
    await platformApiFetch('/api/v1/a');
    await platformApiFetch('/api/v1/b');
    await platformApiFetch('/api/v1/c');
    // First call = status probe + actual request; subsequent calls = actual request only
    expect(mock).toHaveBeenCalledTimes(4); // 1 probe + 3 API calls
  });
});
