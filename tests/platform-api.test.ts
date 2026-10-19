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
