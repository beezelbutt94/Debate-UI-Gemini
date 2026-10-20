import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// platform-api.ts uses module-level memoisation of the probe. We need to
// re-import it fresh for each test group to reset that state.
// We do this by resetting the module registry and re-requiring.

describe('platformApiFetch()', () => {
  let originalFetch: typeof global.fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    // Reset module so configuredProbe is cleared between test suites
    vi.resetModules();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns { state: "unavailable" } when platform-status reports not configured', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ configured: false }),
      status: 200,
    } as Response);

    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/test');
    expect(result.state).toBe('unavailable');
  });

  it('returns { state: "unavailable" } when platform-status fetch throws', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network error'));

    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/test');
    expect(result.state).toBe('unavailable');
  });

  it('returns { state: "unavailable" } when platform-status returns non-ok', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ configured: false }),
      status: 503,
    } as Response);

    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/test');
    expect(result.state).toBe('unavailable');
  });

  it('returns { state: "ok", data } when request succeeds', async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      callCount++;
      if (typeof url === 'string' && url.includes('platform-status')) {
        return { ok: true, json: async () => ({ configured: true }), status: 200 } as Response;
      }
      return { ok: true, json: async () => ({ id: '123', name: 'Test' }), status: 200 } as Response;
    });

    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch<{ id: string; name: string }>('/api/v1/test');
    expect(result.state).toBe('ok');
    if (result.state === 'ok') {
      expect(result.data).toEqual({ id: '123', name: 'Test' });
    }
  });

  it('returns { state: "not_found" } on 404', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('platform-status')) {
        return { ok: true, json: async () => ({ configured: true }), status: 200 } as Response;
      }
      return { ok: false, status: 404, json: async () => ({ detail: 'Not found' }) } as Response;
    });

    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/renders/missing');
    expect(result.state).toBe('not_found');
  });

  it('returns { state: "error", message } on non-404 error with detail', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('platform-status')) {
        return { ok: true, json: async () => ({ configured: true }), status: 200 } as Response;
      }
      return {
        ok: false,
        status: 500,
        json: async () => ({ detail: 'Internal Server Error' }),
      } as Response;
    });

    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/test');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toBe('Internal Server Error');
    }
  });

  it('returns { state: "error" } with status-code message when body is non-JSON', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('platform-status')) {
        return { ok: true, json: async () => ({ configured: true }), status: 200 } as Response;
      }
      return {
        ok: false,
        status: 503,
        json: async () => { throw new Error('Not JSON'); },
      } as unknown as Response;
    });

    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/test');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toContain('503');
    }
  });

  it('returns { state: "unreachable", message } when the actual endpoint throws after platform is configured', async () => {
    let called = false;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('platform-status')) {
        return { ok: true, json: async () => ({ configured: true }), status: 200 } as Response;
      }
      if (!called) {
        called = true;
        throw new Error('Connection refused');
      }
      return { ok: true, json: async () => ({}), status: 200 } as Response;
    });

    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/test');
    expect(result.state).toBe('unreachable');
    if (result.state === 'unreachable') {
      expect(result.message).toContain('Connection refused');
    }
  });

  it('returns { state: "error" } with status-code fallback when error body has no detail field', async () => {
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('platform-status')) {
        return { ok: true, json: async () => ({ configured: true }), status: 200 } as Response;
      }
      return {
        ok: false,
        status: 422,
        json: async () => ({ code: 'VALIDATION_ERROR', fields: ['name'] }),
      } as Response;
    });

    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/test');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toContain('422');
    }
  });

  it('memoises the platform-status probe (probe fetch fires only once across two calls)', async () => {
    let platformStatusCalls = 0;
    global.fetch = vi.fn().mockImplementation(async (url: string) => {
      if (typeof url === 'string' && url.includes('platform-status')) {
        platformStatusCalls++;
        return { ok: true, json: async () => ({ configured: true }), status: 200 } as Response;
      }
      return { ok: true, json: async () => ({}), status: 200 } as Response;
    });

    const { platformApiFetch } = await import('@/lib/platform-api');
    await platformApiFetch('/api/v1/first');
    await platformApiFetch('/api/v1/second');
    expect(platformStatusCalls).toBe(1);
  });
});
