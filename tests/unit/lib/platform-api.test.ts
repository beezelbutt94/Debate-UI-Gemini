import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// platformApiFetch uses module-level memoized probe (configuredProbe).
// We reset modules before every test so each import gets a clean module state.

type PlatformApiResult<T> =
  | { state: 'ok'; data: T }
  | { state: 'unavailable' }
  | { state: 'unreachable'; message: string }
  | { state: 'not_found' }
  | { state: 'error'; message: string };

async function freshImport(mockFetch: ReturnType<typeof vi.fn>) {
  vi.resetModules();
  vi.stubGlobal('fetch', mockFetch);
  const mod = await import('@/lib/platform-api');
  return mod.platformApiFetch as <T>(path: string, init?: RequestInit) => Promise<PlatformApiResult<T>>;
}

function probeUnavailable(): Response {
  return { ok: true, json: async () => ({ configured: false }) } as Response;
}

function probeConfigured(): Response {
  return { ok: true, json: async () => ({ configured: true }) } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('platformApiFetch() — unavailable platform', () => {
  it('returns state="unavailable" when platform-status reports not configured', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce(probeUnavailable());
    const fn = await freshImport(mockFetch);
    const result = await fn('/api/v1/test');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns state="unavailable" when platform-status fetch throws', async () => {
    const mockFetch = vi.fn().mockRejectedValueOnce(new Error('Network error'));
    const fn = await freshImport(mockFetch);
    const result = await fn('/api/v1/test');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns state="unavailable" when platform-status returns non-ok', async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({ ok: false, json: async () => ({}) } as Response);
    const fn = await freshImport(mockFetch);
    const result = await fn('/api/v1/test');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('probes platform-status before the actual request', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(probeUnavailable());
    const fn = await freshImport(mockFetch);
    await fn('/api/v1/anything');
    // Only one fetch call (the probe), since unavailable short-circuits
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith('/api/platform-status');
  });
});

describe('platformApiFetch() — configured platform', () => {
  it('returns state="ok" with data on successful response', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(probeConfigured())
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ foo: 'bar' }) } as Response);
    const fn = await freshImport(mockFetch);
    const result = await fn<{ foo: string }>('/api/v1/test');
    expect(result.state).toBe('ok');
    if (result.state === 'ok') {
      expect(result.data).toEqual({ foo: 'bar' });
    }
  });

  it('returns state="not_found" on 404', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(probeConfigured())
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) } as Response);
    const fn = await freshImport(mockFetch);
    const result = await fn('/api/v1/missing');
    expect(result.state).toBe('not_found');
  });

  it('returns state="error" with detail message on non-404 error', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(probeConfigured())
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ detail: 'Internal Server Error' }),
      } as Response);
    const fn = await freshImport(mockFetch);
    const result = await fn('/api/v1/broken');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toBe('Internal Server Error');
    }
  });

  it('uses status-code message when body has no detail field', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(probeConfigured())
      .mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) } as Response);
    const fn = await freshImport(mockFetch);
    const result = await fn('/api/v1/down');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toContain('503');
    }
  });

  it('returns state="unreachable" when fetch throws after probe succeeds', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(probeConfigured())
      .mockRejectedValueOnce(new Error('Connection refused'));
    const fn = await freshImport(mockFetch);
    const result = await fn('/api/v1/test');
    expect(result.state).toBe('unreachable');
    if (result.state === 'unreachable') {
      expect(result.message).toContain('Connection refused');
    }
  });

  it('handles non-JSON error body gracefully', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(probeConfigured())
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => { throw new SyntaxError('Not JSON'); },
      } as unknown as Response);
    const fn = await freshImport(mockFetch);
    const result = await fn('/api/v1/broken');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toContain('502');
    }
  });

  it('probe result is memoized — status only fetched once across calls', async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce(probeConfigured())             // probe
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) } as Response)  // call 1
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({}) } as Response); // call 2
    const fn = await freshImport(mockFetch);
    await fn('/api/v1/a');
    await fn('/api/v1/b');
    // Total: 1 probe + 2 actual = 3 calls
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(mockFetch.mock.calls[0][0]).toBe('/api/platform-status');
    expect(mockFetch.mock.calls[1][0]).toBe('/api/v1/a');
    expect(mockFetch.mock.calls[2][0]).toBe('/api/v1/b');
  });
});
