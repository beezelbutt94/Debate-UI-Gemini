import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PlatformApiResult } from '@/lib/platform-api';

// platformApiFetch uses a module-level memoized promise, so we need to
// re-import freshly for each test group. We do this by mocking fetch globally.

describe('platformApiFetch', () => {
  let platformApiFetch: <T>(path: string, init?: RequestInit) => Promise<PlatformApiResult<T>>;

  // Reset module registry so the memoized `configuredProbe` is cleared each test
  beforeEach(async () => {
    vi.resetModules();
    const mod = await import('@/lib/platform-api');
    platformApiFetch = mod.platformApiFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns { state: "unavailable" } when platform-status reports not configured', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ configured: false }),
    }));

    const result = await platformApiFetch('/api/v1/some-path');
    expect(result.state).toBe('unavailable');
  });

  it('returns { state: "unavailable" } when platform-status fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('Network error')));

    const result = await platformApiFetch('/api/v1/some-path');
    expect(result.state).toBe('unavailable');
  });

  it('returns { state: "unavailable" } when platform-status returns non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce({
      ok: false,
      json: async () => ({ configured: false }),
    }));

    const result = await platformApiFetch('/api/v1/some-path');
    expect(result.state).toBe('unavailable');
  });

  it('returns { state: "ok", data } on a successful configured request', async () => {
    const mockData = { videoId: 'abc', status: 'complete' };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) }) // platform-status
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => mockData });  // actual API call

    vi.stubGlobal('fetch', fetchMock);

    const result = await platformApiFetch<typeof mockData>('/api/v1/videos/abc');
    expect(result.state).toBe('ok');
    if (result.state === 'ok') {
      expect(result.data).toEqual(mockData);
    }
  });

  it('returns { state: "not_found" } on 404 from configured platform', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) })
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({}) });

    vi.stubGlobal('fetch', fetchMock);

    const result = await platformApiFetch('/api/v1/videos/nonexistent');
    expect(result.state).toBe('not_found');
  });

  it('returns { state: "unreachable" } when the configured platform is unreachable', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) })
      .mockRejectedValueOnce(new Error('ECONNREFUSED'));

    vi.stubGlobal('fetch', fetchMock);

    const result = await platformApiFetch('/api/v1/some-path');
    expect(result.state).toBe('unreachable');
    if (result.state === 'unreachable') {
      expect(result.message).toContain('ECONNREFUSED');
    }
  });

  it('returns { state: "error" } on non-404 HTTP error with detail message', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) })
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ detail: 'Internal server error' }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const result = await platformApiFetch('/api/v1/some-path');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toBe('Internal server error');
    }
  });

  it('returns { state: "error" } with status-based message when error body has no detail', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => ({ some: 'other field' }),
      });

    vi.stubGlobal('fetch', fetchMock);

    const result = await platformApiFetch('/api/v1/some-path');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toContain('503');
    }
  });

  it('returns { state: "error" } with status-based message when error body is non-JSON', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) })
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: async () => { throw new SyntaxError('Not JSON'); },
      });

    vi.stubGlobal('fetch', fetchMock);

    const result = await platformApiFetch('/api/v1/some-path');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toContain('502');
    }
  });
});
