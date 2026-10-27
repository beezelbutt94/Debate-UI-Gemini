import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// platform-api.ts uses a module-level memoized probe. We must reset it
// between tests by re-importing a fresh module instance.

describe('platformApiFetch()', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function load() {
    const mod = await import('@/lib/platform-api');
    return mod.platformApiFetch;
  }

  it('returns { state: "unavailable" } when platform-status says not configured', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url === '/api/platform-status') {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ configured: false }),
          });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      })
    );

    const platformApiFetch = await load();
    const result = await platformApiFetch('/api/v1/something');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns { state: "unavailable" } when platform-status fetch throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url === '/api/platform-status') {
          return Promise.reject(new Error('network error'));
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      })
    );

    const platformApiFetch = await load();
    const result = await platformApiFetch('/api/v1/something');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns { state: "unavailable" } when platform-status returns not-ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url === '/api/platform-status') {
          return Promise.resolve({ ok: false });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
      })
    );

    const platformApiFetch = await load();
    const result = await platformApiFetch('/api/v1/something');
    // non-ok status → configured defaults to false → unavailable
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns { state: "ok", data } on successful response when configured', async () => {
    const payload = { id: 42, name: 'test' };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url === '/api/platform-status') {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ configured: true }) });
        }
        return Promise.resolve({ ok: true, json: () => Promise.resolve(payload) });
      })
    );

    const platformApiFetch = await load();
    const result = await platformApiFetch<{ id: number; name: string }>('/api/v1/something');
    expect(result).toEqual({ state: 'ok', data: payload });
  });

  it('returns { state: "not_found" } on 404 when configured', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url === '/api/platform-status') {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ configured: true }) });
        }
        return Promise.resolve({ ok: false, status: 404 });
      })
    );

    const platformApiFetch = await load();
    const result = await platformApiFetch('/api/v1/missing');
    expect(result).toEqual({ state: 'not_found' });
  });

  it('returns { state: "error", message } on non-404 error when configured', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url === '/api/platform-status') {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ configured: true }) });
        }
        return Promise.resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ detail: 'Internal server error' }),
        });
      })
    );

    const platformApiFetch = await load();
    const result = await platformApiFetch('/api/v1/broken');
    expect(result).toEqual({ state: 'error', message: 'Internal server error' });
  });

  it('falls back to status-code message when error body has no detail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url === '/api/platform-status') {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ configured: true }) });
        }
        return Promise.resolve({
          ok: false,
          status: 503,
          json: () => Promise.resolve({}),
        });
      })
    );

    const platformApiFetch = await load();
    const result = await platformApiFetch('/api/v1/broken');
    expect(result).toMatchObject({ state: 'error', message: expect.stringContaining('503') });
  });

  it('returns { state: "unreachable" } when the actual fetch throws after configured check', async () => {
    let callCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url === '/api/platform-status') {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ configured: true }) });
        }
        callCount++;
        return Promise.reject(new Error('Connection refused'));
      })
    );

    const platformApiFetch = await load();
    const result = await platformApiFetch('/api/v1/something');
    expect(result).toEqual({ state: 'unreachable', message: 'Connection refused' });
    expect(callCount).toBe(1);
  });

  it('falls back to status message when error body json() throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) => {
        if (url === '/api/platform-status') {
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ configured: true }) });
        }
        return Promise.resolve({
          ok: false,
          status: 502,
          json: () => Promise.reject(new Error('not json')),
        });
      })
    );

    const platformApiFetch = await load();
    const result = await platformApiFetch('/api/v1/bad-gateway');
    expect(result).toMatchObject({ state: 'error', message: expect.stringContaining('502') });
  });
});
