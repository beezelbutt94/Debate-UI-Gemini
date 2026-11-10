import { describe, it, expect, vi, beforeEach } from 'vitest';

// platform-api.ts uses a module-level memoised configuredProbe. We import
// fresh each test suite so the cache doesn't leak across describe blocks, by
// re-importing with a cache-busting query. Instead we just reset the internal
// state via vi.resetModules() before each test.

describe('platformApiFetch — unavailable (platform not configured)', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ configured: false }),
    }));
  });

  it('returns state=unavailable when /api/platform-status says not configured', async () => {
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/anything');
    expect(result.state).toBe('unavailable');
  });
});

describe('platformApiFetch — configured, 200 OK', () => {
  beforeEach(() => {
    vi.resetModules();
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      callCount++;
      if (callCount === 1) {
        // first call: /api/platform-status
        return Promise.resolve({
          ok: true,
          json: async () => ({ configured: true }),
        });
      }
      // subsequent calls: actual API
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ id: 'render-1', name: 'My Render' }),
      });
    }));
  });

  it('returns state=ok with parsed data', async () => {
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch<{ id: string }>('/api/v1/renders/1');
    expect(result.state).toBe('ok');
    if (result.state === 'ok') {
      expect(result.data).toEqual({ id: 'render-1', name: 'My Render' });
    }
  });
});

describe('platformApiFetch — configured, 404', () => {
  beforeEach(() => {
    vi.resetModules();
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ ok: true, json: async () => ({ configured: true }) });
      }
      return Promise.resolve({ ok: false, status: 404, json: async () => ({}) });
    }));
  });

  it('returns state=not_found for 404', async () => {
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/renders/missing');
    expect(result.state).toBe('not_found');
  });
});

describe('platformApiFetch — configured, non-404 error with JSON detail', () => {
  beforeEach(() => {
    vi.resetModules();
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ ok: true, json: async () => ({ configured: true }) });
      }
      return Promise.resolve({
        ok: false,
        status: 500,
        json: async () => ({ detail: 'Internal server error from backend' }),
      });
    }));
  });

  it('returns state=error with the detail field as message', async () => {
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/broken');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toBe('Internal server error from backend');
    }
  });
});

describe('platformApiFetch — configured, non-404 error without JSON detail', () => {
  beforeEach(() => {
    vi.resetModules();
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ ok: true, json: async () => ({ configured: true }) });
      }
      return Promise.resolve({
        ok: false,
        status: 503,
        json: async () => { throw new Error('not json'); },
      });
    }));
  });

  it('returns state=error with status code message when body is not JSON', async () => {
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/broken');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toContain('503');
    }
  });
});

describe('platformApiFetch — configured, fetch throws (unreachable)', () => {
  beforeEach(() => {
    vi.resetModules();
    let callCount = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ ok: true, json: async () => ({ configured: true }) });
      }
      return Promise.reject(new Error('ECONNREFUSED'));
    }));
  });

  it('returns state=unreachable with error message', async () => {
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/anything');
    expect(result.state).toBe('unreachable');
    if (result.state === 'unreachable') {
      expect(result.message).toContain('ECONNREFUSED');
    }
  });
});

describe('platformApiFetch — /api/platform-status fetch throws', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
  });

  it('returns state=unavailable when the probe itself errors', async () => {
    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/anything');
    expect(result.state).toBe('unavailable');
  });
});
