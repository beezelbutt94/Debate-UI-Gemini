import { describe, it, expect, vi, beforeEach } from 'vitest';

// platform-api uses a module-level memoized probe — we reset it between tests
// by re-importing the module each time via dynamic import after clearing the cache.
// Since vitest re-runs module evaluation when vi.resetModules() is called we
// can control the fetch mock before each import.

describe('platformApiFetch()', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  async function getPlatformApiFetch() {
    const mod = await import('@/lib/platform-api');
    return mod.platformApiFetch;
  }

  function mockFetch(responses: Array<{ ok: boolean; status?: number; json?: () => Promise<unknown> }>) {
    let call = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      const r = responses[call++] ?? responses[responses.length - 1];
      return {
        ok: r.ok,
        status: r.status ?? (r.ok ? 200 : 500),
        json: r.json ?? (() => Promise.resolve({})),
      } as unknown as Response;
    }));
  }

  it('returns { state: "unavailable" } when /api/platform-status says not configured', async () => {
    mockFetch([{ ok: true, json: () => Promise.resolve({ configured: false }) }]);
    const platformApiFetch = await getPlatformApiFetch();
    const result = await platformApiFetch('/api/v1/some-resource');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns { state: "unavailable" } when /api/platform-status fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network error'))));
    const platformApiFetch = await getPlatformApiFetch();
    const result = await platformApiFetch('/api/v1/some-resource');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns { state: "unavailable" } when /api/platform-status responds non-ok', async () => {
    mockFetch([{ ok: false, status: 503 }]);
    const platformApiFetch = await getPlatformApiFetch();
    const result = await platformApiFetch('/api/v1/some-resource');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns { state: "ok", data } on success when configured', async () => {
    const payload = { id: 'abc', name: 'Test Render' };
    mockFetch([
      { ok: true, json: () => Promise.resolve({ configured: true }) },
      { ok: true, json: () => Promise.resolve(payload) },
    ]);
    const platformApiFetch = await getPlatformApiFetch();
    const result = await platformApiFetch<typeof payload>('/api/v1/renders/abc');
    expect(result).toEqual({ state: 'ok', data: payload });
  });

  it('returns { state: "not_found" } on 404 when configured', async () => {
    mockFetch([
      { ok: true, json: () => Promise.resolve({ configured: true }) },
      { ok: false, status: 404 },
    ]);
    const platformApiFetch = await getPlatformApiFetch();
    const result = await platformApiFetch('/api/v1/renders/missing');
    expect(result).toEqual({ state: 'not_found' });
  });

  it('returns { state: "unreachable" } when configured but actual request throws', async () => {
    let call = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (call++ === 0) {
        // platform-status probe succeeds
        return { ok: true, status: 200, json: () => Promise.resolve({ configured: true }) } as unknown as Response;
      }
      throw new Error('ECONNREFUSED');
    }));
    const platformApiFetch = await getPlatformApiFetch();
    const result = await platformApiFetch('/api/v1/renders');
    expect(result).toEqual({ state: 'unreachable', message: 'ECONNREFUSED' });
  });

  it('returns { state: "error" } with status message for non-404 error response', async () => {
    mockFetch([
      { ok: true, json: () => Promise.resolve({ configured: true }) },
      { ok: false, status: 500, json: () => Promise.resolve({}) },
    ]);
    const platformApiFetch = await getPlatformApiFetch();
    const result = await platformApiFetch('/api/v1/renders');
    expect(result).toMatchObject({ state: 'error', message: 'Request failed (500)' });
  });

  it('returns { state: "error" } with backend detail when provided', async () => {
    mockFetch([
      { ok: true, json: () => Promise.resolve({ configured: true }) },
      { ok: false, status: 422, json: () => Promise.resolve({ detail: 'Validation error: missing field' }) },
    ]);
    const platformApiFetch = await getPlatformApiFetch();
    const result = await platformApiFetch('/api/v1/renders');
    expect(result).toMatchObject({ state: 'error', message: 'Validation error: missing field' });
  });

  it('returns { state: "error" } when error response body is non-JSON', async () => {
    let call = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      if (call++ === 0) {
        return { ok: true, status: 200, json: () => Promise.resolve({ configured: true }) } as unknown as Response;
      }
      return {
        ok: false,
        status: 503,
        json: () => Promise.reject(new Error('not json')),
      } as unknown as Response;
    }));
    const platformApiFetch = await getPlatformApiFetch();
    const result = await platformApiFetch('/api/v1/renders');
    expect(result).toMatchObject({ state: 'error', message: 'Request failed (503)' });
  });
});
