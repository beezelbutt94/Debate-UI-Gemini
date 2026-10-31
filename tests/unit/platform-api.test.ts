import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * platformApiFetch tests.
 *
 * The module has a module-level `configuredProbe` variable that memoises the
 * platform-status probe result within a page load. To get a fresh `null`
 * probe before each test, we reset the module registry and re-import
 * dynamically so each test sees a brand-new module instance.
 */

type PlatformApiResult<T> =
  | { state: 'ok'; data: T }
  | { state: 'unavailable' }
  | { state: 'unreachable'; message: string }
  | { state: 'not_found' }
  | { state: 'error'; message: string };

describe('platformApiFetch', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Helper: create a minimal Response-like object
  function makeResponse(
    ok: boolean,
    status: number,
    jsonBody: unknown
  ): Response {
    return {
      ok,
      status,
      json: () => Promise.resolve(jsonBody),
      text: () => Promise.resolve(JSON.stringify(jsonBody)),
    } as unknown as Response;
  }

  // ── Returns 'unavailable' when the probe says not configured ─────────────

  it('returns unavailable when /api/platform-status says configured=false', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(makeResponse(true, 200, { configured: false }))
    );
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch<unknown>('/api/v1/videos');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns unavailable when /api/platform-status responds with ok=false', async () => {
    // When res.ok is false, the then-chain yields `{ configured: false }` directly
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(makeResponse(false, 503, {}))
    );
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch<unknown>('/api/v1/videos');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns unavailable when the probe fetch itself throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Network error')));
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch<unknown>('/api/v1/videos');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns unavailable when platform-status body has no configured field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValueOnce(makeResponse(true, 200, {}))
    );
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch<unknown>('/api/v1/videos');
    expect(result).toEqual({ state: 'unavailable' });
  });

  // ── Returns 'unreachable' when configured but actual fetch throws ─────────

  it('returns unreachable when the configured probe passes but the actual fetch throws', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(true, 200, { configured: true })) // probe
      .mockRejectedValueOnce(new Error('ECONNREFUSED')); // actual call

    vi.stubGlobal('fetch', mockFetch);
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch<unknown>('/api/v1/videos');
    expect(result).toEqual({ state: 'unreachable', message: 'ECONNREFUSED' });
  });

  // ── Returns 'not_found' on 404 ────────────────────────────────────────────

  it('returns not_found when the backend returns 404', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(true, 200, { configured: true }))
      .mockResolvedValueOnce(makeResponse(false, 404, { detail: 'not found' }));

    vi.stubGlobal('fetch', mockFetch);
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch<unknown>('/api/v1/missing');
    expect(result).toEqual({ state: 'not_found' });
  });

  // ── Returns 'error' on non-ok, non-404 responses ─────────────────────────

  it('returns error with detail message when backend returns non-ok JSON with detail', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(true, 200, { configured: true }))
      .mockResolvedValueOnce(makeResponse(false, 422, { detail: 'Validation failed' }));

    vi.stubGlobal('fetch', mockFetch);
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch<unknown>('/api/v1/bad');
    expect(result).toEqual({ state: 'error', message: 'Validation failed' });
  });

  it('returns error with status-code message when body has no detail', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(true, 200, { configured: true }))
      .mockResolvedValueOnce(makeResponse(false, 500, {}));

    vi.stubGlobal('fetch', mockFetch);
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch<unknown>('/api/v1/crash');
    expect(result).toEqual({ state: 'error', message: 'Request failed (500)' });
  });

  it('returns error with fallback message when response body is not valid JSON', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/platform-status') {
        return Promise.resolve(makeResponse(true, 200, { configured: true }));
      }
      return Promise.resolve({
        ok: false,
        status: 502,
        json: () => Promise.reject(new SyntaxError('Not JSON')),
        text: () => Promise.resolve('<html>Bad Gateway</html>'),
      } as unknown as Response);
    });

    vi.stubGlobal('fetch', mockFetch);
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch<unknown>('/api/v1/crash');
    expect(result).toEqual({ state: 'error', message: 'Request failed (502)' });
  });

  // ── Returns 'ok' on success ───────────────────────────────────────────────

  it('returns ok with parsed JSON data on a 200 response', async () => {
    const payload = { id: 42, name: 'video-123' };
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(true, 200, { configured: true }))
      .mockResolvedValueOnce(makeResponse(true, 200, payload));

    vi.stubGlobal('fetch', mockFetch);
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch<{ id: number; name: string }>('/api/v1/videos/42');
    expect(result).toEqual({ state: 'ok', data: payload });
  });

  it('passes RequestInit options through to the actual fetch call', async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(true, 200, { configured: true }))
      .mockResolvedValueOnce(makeResponse(true, 200, {}));

    vi.stubGlobal('fetch', mockFetch);
    const { platformApiFetch } = await import('@/lib/platform-api');
    await platformApiFetch<unknown>('/api/v1/create', { method: 'POST', body: '{}' });

    const [actualUrl, actualInit] = mockFetch.mock.calls[1];
    expect(actualUrl).toBe('/api/v1/create');
    expect((actualInit as RequestInit).method).toBe('POST');
  });

  // ── Probe is memoised ────────────────────────────────────────────────────

  it('only probes /api/platform-status once per module instance even with multiple calls', async () => {
    const payload = { id: 1 };
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(true, 200, { configured: true })) // probe (once)
      .mockResolvedValueOnce(makeResponse(true, 200, payload))              // call 1
      .mockResolvedValueOnce(makeResponse(true, 200, payload));             // call 2

    vi.stubGlobal('fetch', mockFetch);
    const { platformApiFetch } = await import('@/lib/platform-api');

    await platformApiFetch('/api/v1/a');
    await platformApiFetch('/api/v1/b');

    const probeCalls = (mockFetch.mock.calls as string[][]).filter(
      ([url]) => url === '/api/platform-status'
    );
    expect(probeCalls).toHaveLength(1);
  });
});
