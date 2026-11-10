import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Helpers to build minimal Response-like objects understood by the fetch mock.
function mockResponse(options: { ok: boolean; status?: number; body?: unknown; text?: string }) {
  return {
    ok: options.ok,
    status: options.status ?? (options.ok ? 200 : 500),
    json: vi.fn().mockResolvedValue(options.body ?? {}),
    text: vi.fn().mockResolvedValue(options.text ?? ''),
  };
}

// Each test re-imports the module so the module-level `configuredProbe` cache
// is reset.  vi.resetModules() must be called before the dynamic import.
async function freshImport() {
  vi.resetModules();
  return import('@/lib/platform-api');
}

describe('platformApiFetch()', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('returns { state: "unavailable" } when platform-status reports not configured', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
      mockResponse({ ok: true, body: { configured: false } })
    ));
    const { platformApiFetch } = await freshImport();
    const result = await platformApiFetch('/api/v1/test');
    expect(result.state).toBe('unavailable');
  });

  it('returns { state: "unavailable" } when platform-status fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValueOnce(new Error('network')));
    const { platformApiFetch } = await freshImport();
    const result = await platformApiFetch('/api/v1/test');
    expect(result.state).toBe('unavailable');
  });

  it('returns { state: "unavailable" } when platform-status returns non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(
      mockResponse({ ok: false, status: 500, body: {} })
    ));
    const { platformApiFetch } = await freshImport();
    const result = await platformApiFetch('/api/v1/test');
    expect(result.state).toBe('unavailable');
  });

  it('returns { state: "ok", data } when platform configured and request succeeds', async () => {
    const payload = { id: 'r1', title: 'Test' };
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockResponse({ ok: true, body: { configured: true } }))
      .mockResolvedValueOnce(mockResponse({ ok: true, body: payload }))
    );
    const { platformApiFetch } = await freshImport();
    const result = await platformApiFetch<typeof payload>('/api/v1/test');
    expect(result.state).toBe('ok');
    if (result.state === 'ok') {
      expect(result.data).toEqual(payload);
    }
  });

  it('returns { state: "not_found" } on 404', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockResponse({ ok: true, body: { configured: true } }))
      .mockResolvedValueOnce(mockResponse({ ok: false, status: 404 }))
    );
    const { platformApiFetch } = await freshImport();
    const result = await platformApiFetch('/api/v1/missing');
    expect(result.state).toBe('not_found');
  });

  it('returns { state: "error" } with status code message on non-JSON error body', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockResponse({ ok: true, body: { configured: true } }))
      .mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: vi.fn().mockRejectedValue(new SyntaxError('not json')),
      })
    );
    const { platformApiFetch } = await freshImport();
    const result = await platformApiFetch('/api/v1/broken');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toContain('500');
    }
  });

  it('returns { state: "error" } with detail from JSON error body', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockResponse({ ok: true, body: { configured: true } }))
      .mockResolvedValueOnce(mockResponse({ ok: false, status: 422, body: { detail: 'Validation failed' } }))
    );
    const { platformApiFetch } = await freshImport();
    const result = await platformApiFetch('/api/v1/validate');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toBe('Validation failed');
    }
  });

  it('returns { state: "unreachable" } when platform configured but fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(mockResponse({ ok: true, body: { configured: true } }))
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
    );
    const { platformApiFetch } = await freshImport();
    const result = await platformApiFetch('/api/v1/test');
    expect(result.state).toBe('unreachable');
    if (result.state === 'unreachable') {
      expect(result.message).toContain('ECONNREFUSED');
    }
  });

  it('memoizes the platform-status probe: only calls /api/platform-status once', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockResponse({ ok: true, body: { configured: false } }))
      .mockResolvedValue(mockResponse({ ok: false, status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    const { platformApiFetch } = await freshImport();
    await platformApiFetch('/api/v1/a');
    await platformApiFetch('/api/v1/b');
    // Only the probe call should have happened once; the actual requests
    // didn't fire because configured=false → unavailable short-circuit.
    const statusCalls = fetchMock.mock.calls.filter((c) =>
      (c[0] as string).includes('platform-status')
    );
    expect(statusCalls.length).toBe(1);
  });
});
