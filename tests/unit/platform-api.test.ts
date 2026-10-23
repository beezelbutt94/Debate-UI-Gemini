import { describe, it, expect, vi, beforeEach } from 'vitest';

// We need to reset the module between tests because the module has a
// module-level `configuredProbe` cache variable. Re-importing fresh via
// `vi.resetModules()` + dynamic import lets us start clean each time.

describe('platformApiFetch()', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('returns unavailable when platform-status says not configured', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ configured: false }),
      status: 200,
    }));

    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/some/path');
    expect(result.state).toBe('unavailable');
  });

  it('returns unavailable when platform-status fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));

    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/some/path');
    expect(result.state).toBe('unavailable');
  });

  it('returns ok with data on a successful response when platform is configured', async () => {
    const mockFetch = vi.fn()
      // First call: platform-status probe
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ configured: true }),
        status: 200,
      })
      // Second call: actual API request
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'render-1', status: 'completed' }),
      });
    vi.stubGlobal('fetch', mockFetch);

    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch<{ id: string; status: string }>('/api/v1/renders/render-1');
    expect(result.state).toBe('ok');
    if (result.state === 'ok') {
      expect(result.data.id).toBe('render-1');
    }
  });

  it('returns not_found on a 404 response', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ configured: true }),
        status: 200,
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({}),
      });
    vi.stubGlobal('fetch', mockFetch);

    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/renders/missing');
    expect(result.state).toBe('not_found');
  });

  it('returns unreachable when the platform is configured but the fetch itself throws', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ configured: true }),
        status: 200,
      })
      .mockRejectedValueOnce(new Error('Connection refused'));
    vi.stubGlobal('fetch', mockFetch);

    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/some/path');
    expect(result.state).toBe('unreachable');
    if (result.state === 'unreachable') {
      expect(result.message).toContain('Connection refused');
    }
  });

  it('returns error on a non-404 bad response with JSON detail', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ configured: true }),
        status: 200,
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ detail: 'Internal server error' }),
      });
    vi.stubGlobal('fetch', mockFetch);

    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/some/path');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toContain('Internal server error');
    }
  });

  it('returns error with status code when response body is not JSON', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ configured: true }),
        status: 200,
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => { throw new Error('not json'); },
      });
    vi.stubGlobal('fetch', mockFetch);

    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/some/path');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toContain('503');
    }
  });
});
