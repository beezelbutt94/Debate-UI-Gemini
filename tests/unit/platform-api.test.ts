import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// platform-api.ts uses a module-level `configuredProbe` cache. We need to
// reset the module between tests that affect the probe state.
// We also stub `fetch` so no real HTTP calls are made.

describe('platformApiFetch()', () => {
  let platformApiFetch: typeof import('@/lib/platform-api').platformApiFetch;

  beforeEach(async () => {
    // Reset module registry so configuredProbe cache is cleared between tests.
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn());
    ({ platformApiFetch } = await import('@/lib/platform-api'));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns { state: "unavailable" } when /api/platform-status says configured=false', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response(JSON.stringify({ configured: false }), { status: 200 })
    );

    const result = await platformApiFetch('/api/v1/some-resource');
    expect(result.state).toBe('unavailable');
  });

  it('returns { state: "unavailable" } when /api/platform-status fetch throws', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network error'));

    const result = await platformApiFetch('/api/v1/some-resource');
    expect(result.state).toBe('unavailable');
  });

  it('returns { state: "unavailable" } when /api/platform-status returns non-ok', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('Service Unavailable', { status: 503 })
    );

    const result = await platformApiFetch('/api/v1/some-resource');
    expect(result.state).toBe('unavailable');
  });

  it('returns { state: "ok", data } when configured and API responds 200', async () => {
    const payload = { id: 'vid_123', status: 'completed' };

    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ configured: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }));

    const result = await platformApiFetch<typeof payload>('/api/v1/videos/vid_123/status');
    expect(result.state).toBe('ok');
    if (result.state === 'ok') {
      expect(result.data).toEqual(payload);
    }
  });

  it('returns { state: "not_found" } when API responds 404', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ configured: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response('Not Found', { status: 404 }));

    const result = await platformApiFetch('/api/v1/videos/missing');
    expect(result.state).toBe('not_found');
  });

  it('returns { state: "error", message } when API responds non-ok (non-404)', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ configured: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'Quota exceeded' }), { status: 429 }));

    const result = await platformApiFetch('/api/v1/videos/generate');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toContain('Quota exceeded');
    }
  });

  it('returns { state: "error" } with status code message when response body is not JSON', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ configured: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response('Internal Server Error', { status: 500 }));

    const result = await platformApiFetch('/api/v1/videos/generate');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toContain('500');
    }
  });

  it('returns { state: "unreachable", message } when configured but actual API fetch throws', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ configured: true }), { status: 200 }))
      .mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await platformApiFetch('/api/v1/videos/generate');
    expect(result.state).toBe('unreachable');
    if (result.state === 'unreachable') {
      expect(result.message).toContain('ECONNREFUSED');
    }
  });

  it('memoizes the platform-status probe (only one /api/platform-status call for two requests)', async () => {
    const payload = { id: 'a' };
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ configured: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: 200 }));

    await platformApiFetch('/api/v1/resource/1');
    await platformApiFetch('/api/v1/resource/2');

    // fetch called 3 times total: 1 probe + 2 API calls (not 4)
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3);
  });

  it('returns { state: "error" } with fallback message when error body has no detail field', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(new Response(JSON.stringify({ configured: true }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: 'oops' }), { status: 400 }));

    const result = await platformApiFetch('/api/v1/resource');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toContain('400');
    }
  });
});
