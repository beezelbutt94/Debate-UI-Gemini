import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// platform-api.ts uses a module-level memoised probe. We need a fresh import
// for each test so that memo is reset. Use vi.resetModules() + dynamic import.

function makeFetch(responses: Array<{ ok: boolean; status?: number; body?: unknown }>) {
  let callIndex = 0;
  return vi.fn(async () => {
    const r = responses[callIndex] ?? responses[responses.length - 1];
    callIndex++;
    return {
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 500),
      json: async () => r.body ?? {},
    };
  });
}

describe('platformApiFetch()', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns {state:"unavailable"} when platform-status reports not configured', async () => {
    const fetchMock = makeFetch([{ ok: true, body: { configured: false } }]);
    vi.stubGlobal('fetch', fetchMock);
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/something');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns {state:"unavailable"} when platform-status fetch throws', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network'));
    vi.stubGlobal('fetch', fetchMock);
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/something');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns {state:"unavailable"} when platform-status returns non-ok', async () => {
    const fetchMock = makeFetch([{ ok: false, status: 503, body: {} }]);
    vi.stubGlobal('fetch', fetchMock);
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/something');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns {state:"ok", data} on successful response', async () => {
    const data = { id: 1, name: 'test' };
    const fetchMock = makeFetch([
      { ok: true, body: { configured: true } },   // platform-status probe
      { ok: true, body: data },                    // actual request
    ]);
    vi.stubGlobal('fetch', fetchMock);
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch<typeof data>('/api/v1/resource');
    expect(result).toEqual({ state: 'ok', data });
  });

  it('returns {state:"not_found"} on 404', async () => {
    const fetchMock = makeFetch([
      { ok: true, body: { configured: true } },
      { ok: false, status: 404, body: {} },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/missing');
    expect(result).toEqual({ state: 'not_found' });
  });

  it('returns {state:"error"} on a non-404 error response', async () => {
    const fetchMock = makeFetch([
      { ok: true, body: { configured: true } },
      { ok: false, status: 500, body: { detail: 'Internal Server Error' } },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/resource');
    expect(result).toEqual({ state: 'error', message: 'Internal Server Error' });
  });

  it('uses generic status message when error body has no "detail"', async () => {
    const fetchMock = makeFetch([
      { ok: true, body: { configured: true } },
      { ok: false, status: 503, body: {} },
    ]);
    vi.stubGlobal('fetch', fetchMock);
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/resource');
    expect(result).toEqual({ state: 'error', message: 'Request failed (503)' });
  });

  it('returns {state:"error"} and uses status message when error body is non-JSON', async () => {
    let callIndex = 0;
    const fetchMock = vi.fn(async () => {
      callIndex++;
      if (callIndex === 1) {
        return { ok: true, status: 200, json: async () => ({ configured: true }) };
      }
      return {
        ok: false,
        status: 500,
        json: async () => { throw new SyntaxError('not json'); },
      };
    });
    vi.stubGlobal('fetch', fetchMock);
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/resource');
    expect(result).toEqual({ state: 'error', message: 'Request failed (500)' });
  });

  it('returns {state:"unreachable"} when platform is configured but fetch throws', async () => {
    let callIndex = 0;
    const fetchMock = vi.fn(async () => {
      callIndex++;
      if (callIndex === 1) {
        return { ok: true, status: 200, json: async () => ({ configured: true }) };
      }
      throw new Error('ECONNREFUSED');
    });
    vi.stubGlobal('fetch', fetchMock);
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/resource');
    expect(result).toEqual({ state: 'unreachable', message: 'ECONNREFUSED' });
  });

  it('memoises the platform-status probe (only calls /api/platform-status once)', async () => {
    const data = { id: 1 };
    const fetchMock = vi.fn(async (url: string) => {
      if (typeof url === 'string' && url.includes('platform-status')) {
        return { ok: true, status: 200, json: async () => ({ configured: true }) };
      }
      return { ok: true, status: 200, json: async () => data };
    });
    vi.stubGlobal('fetch', fetchMock);
    const { platformApiFetch } = await import('@/lib/platform-api');
    await platformApiFetch('/api/v1/a');
    await platformApiFetch('/api/v1/b');
    const probeCalls = (fetchMock.mock.calls as Array<[string]>).filter(([u]) =>
      u.includes('platform-status')
    );
    expect(probeCalls.length).toBe(1);
  });

  it('returns {state:"unavailable"} when platform-status body has no configured key', async () => {
    const fetchMock = makeFetch([{ ok: true, body: {} }]);
    vi.stubGlobal('fetch', fetchMock);
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/something');
    expect(result).toEqual({ state: 'unavailable' });
  });
});
