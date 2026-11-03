import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We test platformApiFetch() by controlling the global fetch mock.
// This module uses a module-level memoized probe (configuredProbe) so
// we need to isolate each test with vi.resetModules() and re-import.

describe('platformApiFetch()', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    vi.resetModules();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  async function loadModule() {
    return import('@/lib/platform-api?t=' + Date.now());
  }

  it('returns { state: "unavailable" } when platform-status says not configured', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ configured: false }),
    } as Response);

    const { platformApiFetch } = await loadModule();
    const result = await platformApiFetch('/api/v1/something');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns { state: "unavailable" } when /api/platform-status fetch fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error('network error'));

    const { platformApiFetch } = await loadModule();
    const result = await platformApiFetch('/api/v1/something');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns { state: "ok", data } on successful configured + 200 response', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ configured: true }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'render-1', url: 'https://cdn.example.com/1.mp4' }),
      } as Response);

    const { platformApiFetch } = await loadModule();
    const result = await platformApiFetch('/api/v1/renders/1');
    expect(result).toEqual({ state: 'ok', data: { id: 'render-1', url: 'https://cdn.example.com/1.mp4' } });
  });

  it('returns { state: "not_found" } on 404', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ configured: true }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({}),
      } as Response);

    const { platformApiFetch } = await loadModule();
    const result = await platformApiFetch('/api/v1/renders/missing');
    expect(result).toEqual({ state: 'not_found' });
  });

  it('returns { state: "error", message } on non-404 error with JSON detail', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ configured: true }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ detail: 'Invalid payload' }),
      } as Response);

    const { platformApiFetch } = await loadModule();
    const result = await platformApiFetch('/api/v1/renders');
    expect(result).toEqual({ state: 'error', message: 'Invalid payload' });
  });

  it('returns { state: "error", message } with status code fallback when body has no detail', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ configured: true }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      } as Response);

    const { platformApiFetch } = await loadModule();
    const result = await platformApiFetch('/api/v1/renders');
    expect(result).toEqual({ state: 'error', message: 'Request failed (500)' });
  });

  it('returns { state: "error" } when error body is non-JSON', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ configured: true }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => { throw new Error('not json'); },
      } as unknown as Response);

    const { platformApiFetch } = await loadModule();
    const result = await platformApiFetch('/api/v1/renders');
    expect(result).toEqual({ state: 'error', message: 'Request failed (503)' });
  });

  it('returns { state: "unreachable" } when platform is configured but request throws', async () => {
    globalThis.fetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ configured: true }),
      } as Response)
      .mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const { platformApiFetch } = await loadModule();
    const result = await platformApiFetch('/api/v1/renders');
    expect(result).toEqual({ state: 'unreachable', message: 'ECONNREFUSED' });
  });

  it('returns { state: "unavailable" } when platform-status returns non-ok', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ configured: true }), // body ignored, ok=false → configured:false
    } as Response);

    const { platformApiFetch } = await loadModule();
    const result = await platformApiFetch('/api/v1/something');
    expect(result).toEqual({ state: 'unavailable' });
  });
});
