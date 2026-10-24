import { describe, it, expect, vi, beforeEach } from 'vitest';

// platform-api.ts uses module-level state (configuredProbe), so we reset
// modules between tests that need fresh probe state.

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

function makeResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

describe('platformApiFetch()', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.resetModules(); // reset configuredProbe singleton between tests
  });

  it('returns { state: "unavailable" } when platform is not configured', async () => {
    // probe returns configured: false
    mockFetch.mockResolvedValueOnce(makeResponse({ configured: false }));
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/some-endpoint');
    expect(result.state).toBe('unavailable');
  });

  it('returns { state: "unavailable" } when probe fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/some-endpoint');
    expect(result.state).toBe('unavailable');
  });

  it('returns { state: "ok", data } on 200 response', async () => {
    mockFetch
      .mockResolvedValueOnce(makeResponse({ configured: true }))   // probe
      .mockResolvedValueOnce(makeResponse({ id: 'render-1', status: 'done' })); // actual request
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch<{ id: string }>('/api/v1/renders/1');
    expect(result.state).toBe('ok');
    if (result.state === 'ok') {
      expect(result.data.id).toBe('render-1');
    }
  });

  it('returns { state: "not_found" } on 404 response', async () => {
    mockFetch
      .mockResolvedValueOnce(makeResponse({ configured: true }))
      .mockResolvedValueOnce(makeResponse({}, 404));
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/renders/missing');
    expect(result.state).toBe('not_found');
  });

  it('returns { state: "error" } on 500 response', async () => {
    mockFetch
      .mockResolvedValueOnce(makeResponse({ configured: true }))
      .mockResolvedValueOnce(makeResponse({ detail: 'Internal error' }, 500));
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/renders/bad');
    expect(result.state).toBe('error');
  });

  it('error state includes message from JSON detail', async () => {
    mockFetch
      .mockResolvedValueOnce(makeResponse({ configured: true }))
      .mockResolvedValueOnce(makeResponse({ detail: 'Render failed upstream' }, 503));
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/renders/bad');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toContain('Render failed upstream');
    }
  });

  it('returns { state: "unreachable" } when fetch throws after configured=true', async () => {
    mockFetch
      .mockResolvedValueOnce(makeResponse({ configured: true }))
      .mockRejectedValueOnce(new Error('ECONNREFUSED'));
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/renders/1');
    expect(result.state).toBe('unreachable');
    if (result.state === 'unreachable') {
      expect(result.message).toContain('ECONNREFUSED');
    }
  });

  it('falls back to status code message when error body is not JSON', async () => {
    mockFetch
      .mockResolvedValueOnce(makeResponse({ configured: true }))
      .mockResolvedValueOnce({
        ok: false,
        status: 502,
        json: () => Promise.reject(new Error('not json')),
        text: () => Promise.resolve('Bad gateway'),
      } as unknown as Response);
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/renders/bad');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toContain('502');
    }
  });
});
