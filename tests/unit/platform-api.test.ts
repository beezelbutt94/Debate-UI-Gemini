import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// platform-api.ts uses a module-level memoized probe. We need to reset it
// between tests by re-importing the module fresh via vi.resetModules().

async function freshImport() {
  vi.resetModules();
  const mod = await import('@/lib/platform-api');
  return mod;
}

describe('platformApiFetch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('returns unavailable when platform-status says not configured', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ configured: false }),
      } as Response);
    vi.stubGlobal('fetch', mockFetch);

    const { platformApiFetch } = await freshImport();
    const result = await platformApiFetch('/api/v1/renders/123');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns unavailable when platform-status probe fails', async () => {
    const mockFetch = vi.fn().mockRejectedValueOnce(new Error('network error'));
    vi.stubGlobal('fetch', mockFetch);

    const { platformApiFetch } = await freshImport();
    const result = await platformApiFetch('/api/v1/renders/123');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns unavailable when platform-status returns non-ok', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ configured: false }),
    } as Response);
    vi.stubGlobal('fetch', mockFetch);

    const { platformApiFetch } = await freshImport();
    const result = await platformApiFetch('/api/v1/renders/123');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns ok with data when platform is configured and request succeeds', async () => {
    const payload = { id: 'render-1', status: 'done' };
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => payload } as Response);
    vi.stubGlobal('fetch', mockFetch);

    const { platformApiFetch } = await freshImport();
    const result = await platformApiFetch<typeof payload>('/api/v1/renders/render-1');
    expect(result).toEqual({ state: 'ok', data: payload });
  });

  it('returns not_found when configured and request returns 404', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) } as Response)
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) } as Response);
    vi.stubGlobal('fetch', mockFetch);

    const { platformApiFetch } = await freshImport();
    const result = await platformApiFetch('/api/v1/renders/missing');
    expect(result).toEqual({ state: 'not_found' });
  });

  it('returns error with status message for non-404 error without JSON detail', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => { throw new Error('not json'); },
      } as unknown as Response);
    vi.stubGlobal('fetch', mockFetch);

    const { platformApiFetch } = await freshImport();
    const result = await platformApiFetch('/api/v1/renders/x');
    expect(result).toEqual({ state: 'error', message: 'Request failed (500)' });
  });

  it('returns error with detail message when backend returns JSON detail', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) } as Response)
      .mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({ detail: 'invalid render id' }),
      } as Response);
    vi.stubGlobal('fetch', mockFetch);

    const { platformApiFetch } = await freshImport();
    const result = await platformApiFetch('/api/v1/renders/x');
    expect(result).toEqual({ state: 'error', message: 'invalid render id' });
  });

  it('returns unreachable when configured but actual request throws', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) } as Response)
      .mockRejectedValueOnce(new Error('ECONNREFUSED'));
    vi.stubGlobal('fetch', mockFetch);

    const { platformApiFetch } = await freshImport();
    const result = await platformApiFetch('/api/v1/renders/x');
    expect(result).toEqual({ state: 'unreachable', message: 'ECONNREFUSED' });
  });
});
