import { describe, it, expect, vi, beforeEach } from 'vitest';

// We need module isolation because platformApiFetch uses a module-level
// `configuredProbe` cache that persists across calls.
// Each describe block resets modules so each test group gets a fresh cache.

describe('platformApiFetch – unavailable (platform not configured)', () => {
  let platformApiFetch: typeof import('@/lib/platform-api').platformApiFetch;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ configured: false }),
    }));
    ({ platformApiFetch } = await import('@/lib/platform-api'));
  });

  it('returns state=unavailable when platform-status says not configured', async () => {
    const result = await platformApiFetch('/api/v1/videos');
    expect(result.state).toBe('unavailable');
  });

  it('does not attempt the actual request when unavailable', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ configured: false }),
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();
    const { platformApiFetch: fresh } = await import('@/lib/platform-api');
    await fresh('/api/v1/videos');
    // Only the platform-status probe should have been called once
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/platform-status');
  });
});

describe('platformApiFetch – platform configured, fetch throws (unreachable)', () => {
  let platformApiFetch: typeof import('@/lib/platform-api').platformApiFetch;

  beforeEach(async () => {
    vi.resetModules();
    // First call (probe) resolves configured=true; subsequent calls throw
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ configured: true }),
      })
      .mockRejectedValue(new Error('ECONNREFUSED'));
    vi.stubGlobal('fetch', fetchMock);
    ({ platformApiFetch } = await import('@/lib/platform-api'));
  });

  it('returns state=unreachable with the error message', async () => {
    const result = await platformApiFetch('/api/v1/videos');
    expect(result.state).toBe('unreachable');
    if (result.state === 'unreachable') {
      expect(result.message).toBe('ECONNREFUSED');
    }
  });
});

describe('platformApiFetch – platform configured, 404 response', () => {
  let platformApiFetch: typeof import('@/lib/platform-api').platformApiFetch;

  beforeEach(async () => {
    vi.resetModules();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) })
      .mockResolvedValue({ ok: false, status: 404, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    ({ platformApiFetch } = await import('@/lib/platform-api'));
  });

  it('returns state=not_found for 404', async () => {
    const result = await platformApiFetch('/api/v1/videos/nonexistent');
    expect(result.state).toBe('not_found');
  });
});

describe('platformApiFetch – platform configured, non-ok response with detail', () => {
  let platformApiFetch: typeof import('@/lib/platform-api').platformApiFetch;

  beforeEach(async () => {
    vi.resetModules();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) })
      .mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({ detail: 'Validation error' }),
      });
    vi.stubGlobal('fetch', fetchMock);
    ({ platformApiFetch } = await import('@/lib/platform-api'));
  });

  it('returns state=error with the detail message', async () => {
    const result = await platformApiFetch('/api/v1/videos');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toBe('Validation error');
    }
  });
});

describe('platformApiFetch – platform configured, non-ok response without JSON detail', () => {
  let platformApiFetch: typeof import('@/lib/platform-api').platformApiFetch;

  beforeEach(async () => {
    vi.resetModules();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) })
      .mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => { throw new SyntaxError('not json'); },
      });
    vi.stubGlobal('fetch', fetchMock);
    ({ platformApiFetch } = await import('@/lib/platform-api'));
  });

  it('returns state=error with a fallback status message', async () => {
    const result = await platformApiFetch('/api/v1/videos');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toContain('500');
    }
  });
});

describe('platformApiFetch – platform configured, 200 ok', () => {
  let platformApiFetch: typeof import('@/lib/platform-api').platformApiFetch;

  beforeEach(async () => {
    vi.resetModules();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) })
      .mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: 'vid-1', status: 'completed' }),
      });
    vi.stubGlobal('fetch', fetchMock);
    ({ platformApiFetch } = await import('@/lib/platform-api'));
  });

  it('returns state=ok with parsed data', async () => {
    const result = await platformApiFetch<{ id: string; status: string }>('/api/v1/videos/vid-1');
    expect(result.state).toBe('ok');
    if (result.state === 'ok') {
      expect(result.data).toEqual({ id: 'vid-1', status: 'completed' });
    }
  });

  it('passes through init options to fetch', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) })
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    vi.resetModules();
    const { platformApiFetch: fresh } = await import('@/lib/platform-api');
    await fresh('/api/v1/videos', { method: 'POST', body: '{}' });
    expect(fetchMock).toHaveBeenLastCalledWith('/api/v1/videos', { method: 'POST', body: '{}' });
  });
});

describe('platformApiFetch – probe fetch throws', () => {
  it('treats a probe network error as unconfigured (unavailable)', async () => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network error')));
    const { platformApiFetch: fresh } = await import('@/lib/platform-api');
    const result = await fresh('/api/v1/videos');
    expect(result.state).toBe('unavailable');
  });
});

describe('platformApiFetch – probe cache reuse across multiple calls', () => {
  it('probes platform-status only once even when called multiple times', async () => {
    vi.resetModules();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) })
      .mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    const { platformApiFetch: fresh } = await import('@/lib/platform-api');

    await fresh('/api/v1/a');
    await fresh('/api/v1/b');
    await fresh('/api/v1/c');

    const probeCalls = fetchMock.mock.calls.filter(([url]) => url === '/api/platform-status');
    expect(probeCalls).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(4); // 1 probe + 3 requests
  });
});

describe('platformApiFetch – platform configured, non-ok JSON body without detail key', () => {
  let platformApiFetch: typeof import('@/lib/platform-api').platformApiFetch;

  beforeEach(async () => {
    vi.resetModules();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) })
      .mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ code: 'BAD_REQUEST', error: 'missing field' }),
      });
    vi.stubGlobal('fetch', fetchMock);
    ({ platformApiFetch } = await import('@/lib/platform-api'));
  });

  it('falls back to status-code message when JSON body has no detail field', async () => {
    const result = await platformApiFetch('/api/v1/videos');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toBe('Request failed (400)');
    }
  });

  it('does not include unrelated JSON keys in the error message', async () => {
    const result = await platformApiFetch('/api/v1/videos');
    if (result.state === 'error') {
      expect(result.message).not.toContain('BAD_REQUEST');
      expect(result.message).not.toContain('missing field');
    }
  });
});

describe('platformApiFetch – platform configured, 401 unauthorized', () => {
  let platformApiFetch: typeof import('@/lib/platform-api').platformApiFetch;

  beforeEach(async () => {
    vi.resetModules();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) })
      .mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Authentication required' }),
      });
    vi.stubGlobal('fetch', fetchMock);
    ({ platformApiFetch } = await import('@/lib/platform-api'));
  });

  it('returns state=error with the detail for 401', async () => {
    const result = await platformApiFetch('/api/v1/secured');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toBe('Authentication required');
    }
  });
});

describe('platformApiFetch – platform configured, null detail in JSON', () => {
  let platformApiFetch: typeof import('@/lib/platform-api').platformApiFetch;

  beforeEach(async () => {
    vi.resetModules();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) })
      .mockResolvedValue({
        ok: false,
        status: 503,
        json: async () => ({ detail: null }),
      });
    vi.stubGlobal('fetch', fetchMock);
    ({ platformApiFetch } = await import('@/lib/platform-api'));
  });

  it('falls back to status-code message when detail is null', async () => {
    const result = await platformApiFetch('/api/v1/videos');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toBe('Request failed (503)');
    }
  });
});
