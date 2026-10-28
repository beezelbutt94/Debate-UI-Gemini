import { describe, it, expect, vi, beforeEach } from 'vitest';

// platform-api.ts memoises isPlatformConfigured() in a module-level variable,
// so we need to re-import the module fresh for each test group that changes
// whether the platform is "configured". We do this by resetting module state
// via vi.resetModules() and dynamic import() inside each describe block.

describe('platformApiFetch() — platform not configured', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ configured: false }) }));
  });

  it('returns { state: "unavailable" } when /api/platform-status says not configured', async () => {
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/renders');
    expect(result).toEqual({ state: 'unavailable' });
  });
});

describe('platformApiFetch() — platform configured, various responses', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns { state: "ok", data } on a successful response', async () => {
    const mockData = { id: 'render-1', status: 'done' };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        // First call: /api/platform-status → configured
        .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) })
        // Second call: actual endpoint → 200 ok
        .mockResolvedValueOnce({ ok: true, status: 200, json: async () => mockData })
    );

    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch<typeof mockData>('/api/v1/renders/render-1');
    expect(result).toEqual({ state: 'ok', data: mockData });
  });

  it('returns { state: "not_found" } on a 404 response', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) })
        .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) })
    );

    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/renders/missing');
    expect(result).toEqual({ state: 'not_found' });
  });

  it('returns { state: "error", message } on a non-ok non-404 response with JSON detail', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: async () => ({ detail: 'Internal server error from backend' }),
        })
    );

    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/renders/broken');
    expect(result).toEqual({ state: 'error', message: 'Internal server error from backend' });
  });

  it('returns { state: "error", message } with status code when response body is not JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) })
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
          json: async () => { throw new SyntaxError('not json'); },
        })
    );

    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/renders/bad-gateway');
    expect(result).toMatchObject({ state: 'error', message: expect.stringContaining('502') });
  });

  it('returns { state: "unreachable", message } when the fetch itself throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) })
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
    );

    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/renders/unreachable');
    expect(result).toEqual({ state: 'unreachable', message: 'ECONNREFUSED' });
  });

  it('returns { state: "unavailable" } when /api/platform-status probe itself throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network down')));

    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/renders');
    expect(result).toEqual({ state: 'unavailable' });
  });
});
