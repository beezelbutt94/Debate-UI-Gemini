import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * platformApiFetch() contains module-level memoisation (configuredProbe).
 * We use vi.resetModules() + dynamic import inside each test to get a fresh
 * module state, and vi.stubGlobal to control the global fetch.
 */

function mockFetch(impl: typeof fetch) {
  vi.stubGlobal('fetch', impl);
}

beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

async function freshModule() {
  return import('@/lib/platform-api');
}

// ─── unavailable ──────────────────────────────────────────────────────────

describe('platformApiFetch() – unavailable', () => {
  it('returns { state: "unavailable" } when platform-status says not configured', async () => {
    mockFetch(async (url: RequestInfo | URL) => {
      const u = typeof url === 'string' ? url : url.toString();
      if (u.includes('platform-status')) {
        return new Response(JSON.stringify({ configured: false }), { status: 200 });
      }
      throw new Error('Unexpected fetch call');
    });

    const { platformApiFetch } = await freshModule();
    const result = await platformApiFetch('/api/v1/renders');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns { state: "unavailable" } when platform-status probe fails', async () => {
    mockFetch(async () => {
      throw new Error('network error');
    });

    const { platformApiFetch } = await freshModule();
    const result = await platformApiFetch('/api/v1/renders');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns { state: "unavailable" } when platform-status returns non-ok', async () => {
    mockFetch(async (url: RequestInfo | URL) => {
      const u = typeof url === 'string' ? url : url.toString();
      if (u.includes('platform-status')) {
        return new Response('Not Found', { status: 404 });
      }
      throw new Error('Unexpected fetch call');
    });

    const { platformApiFetch } = await freshModule();
    const result = await platformApiFetch('/api/v1/renders');
    expect(result).toEqual({ state: 'unavailable' });
  });
});

// ─── unreachable ──────────────────────────────────────────────────────────

describe('platformApiFetch() – unreachable', () => {
  it('returns { state: "unreachable" } when backend is configured but throws on actual fetch', async () => {
    let callCount = 0;
    mockFetch(async (url: RequestInfo | URL) => {
      const u = typeof url === 'string' ? url : url.toString();
      callCount++;
      if (u.includes('platform-status')) {
        return new Response(JSON.stringify({ configured: true }), { status: 200 });
      }
      throw new Error('Connection refused');
    });

    const { platformApiFetch } = await freshModule();
    const result = await platformApiFetch('/api/v1/renders');
    expect(result.state).toBe('unreachable');
    if (result.state === 'unreachable') {
      expect(result.message).toBe('Connection refused');
    }
  });
});

// ─── not_found ────────────────────────────────────────────────────────────

describe('platformApiFetch() – not_found', () => {
  it('returns { state: "not_found" } for a 404 response', async () => {
    mockFetch(async (url: RequestInfo | URL) => {
      const u = typeof url === 'string' ? url : url.toString();
      if (u.includes('platform-status')) {
        return new Response(JSON.stringify({ configured: true }), { status: 200 });
      }
      return new Response('Not Found', { status: 404 });
    });

    const { platformApiFetch } = await freshModule();
    const result = await platformApiFetch('/api/v1/renders/missing-id');
    expect(result).toEqual({ state: 'not_found' });
  });
});

// ─── error ────────────────────────────────────────────────────────────────

describe('platformApiFetch() – error', () => {
  it('returns { state: "error" } with a status code message for a non-ok response', async () => {
    mockFetch(async (url: RequestInfo | URL) => {
      const u = typeof url === 'string' ? url : url.toString();
      if (u.includes('platform-status')) {
        return new Response(JSON.stringify({ configured: true }), { status: 200 });
      }
      return new Response('Internal Server Error', { status: 500 });
    });

    const { platformApiFetch } = await freshModule();
    const result = await platformApiFetch('/api/v1/renders');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toContain('500');
    }
  });

  it('extracts .detail from a JSON error body', async () => {
    mockFetch(async (url: RequestInfo | URL) => {
      const u = typeof url === 'string' ? url : url.toString();
      if (u.includes('platform-status')) {
        return new Response(JSON.stringify({ configured: true }), { status: 200 });
      }
      return new Response(JSON.stringify({ detail: 'render job timed out' }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const { platformApiFetch } = await freshModule();
    const result = await platformApiFetch('/api/v1/renders');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toBe('render job timed out');
    }
  });

  it('falls back to status code message for non-JSON error body', async () => {
    mockFetch(async (url: RequestInfo | URL) => {
      const u = typeof url === 'string' ? url : url.toString();
      if (u.includes('platform-status')) {
        return new Response(JSON.stringify({ configured: true }), { status: 200 });
      }
      return new Response('Bad Gateway', { status: 502 });
    });

    const { platformApiFetch } = await freshModule();
    const result = await platformApiFetch('/api/v1/renders');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toContain('502');
    }
  });

  it('uses status code message when JSON error body has no detail field', async () => {
    mockFetch(async (url: RequestInfo | URL) => {
      const u = typeof url === 'string' ? url : url.toString();
      if (u.includes('platform-status')) {
        return new Response(JSON.stringify({ configured: true }), { status: 200 });
      }
      return new Response(JSON.stringify({ code: 'VALIDATION_ERROR', issues: [] }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const { platformApiFetch } = await freshModule();
    const result = await platformApiFetch('/api/v1/renders');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toContain('400');
    }
  });
});

// ─── ok ───────────────────────────────────────────────────────────────────

describe('platformApiFetch() – ok', () => {
  it('returns { state: "ok", data } for a successful response', async () => {
    const payload = { id: 'render-123', status: 'complete' };
    mockFetch(async (url: RequestInfo | URL) => {
      const u = typeof url === 'string' ? url : url.toString();
      if (u.includes('platform-status')) {
        return new Response(JSON.stringify({ configured: true }), { status: 200 });
      }
      return new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const { platformApiFetch } = await freshModule();
    const result = await platformApiFetch<typeof payload>('/api/v1/renders/render-123');
    expect(result.state).toBe('ok');
    if (result.state === 'ok') {
      expect(result.data).toEqual(payload);
    }
  });

  it('forwards RequestInit options to the actual fetch call', async () => {
    let capturedInit: RequestInit | undefined;
    mockFetch(async (url: RequestInfo | URL, init?: RequestInit) => {
      const u = typeof url === 'string' ? url : url.toString();
      if (u.includes('platform-status')) {
        return new Response(JSON.stringify({ configured: true }), { status: 200 });
      }
      capturedInit = init;
      return new Response(JSON.stringify({}), { status: 200 });
    });

    const { platformApiFetch } = await freshModule();
    await platformApiFetch('/api/v1/renders', { method: 'POST', body: '{}' });
    expect(capturedInit?.method).toBe('POST');
    expect(capturedInit?.body).toBe('{}');
  });
});

// ─── memoisation ──────────────────────────────────────────────────────────

describe('platformApiFetch() – probe memoisation', () => {
  it('only probes platform-status once across multiple calls', async () => {
    let probeCount = 0;
    mockFetch(async (url: RequestInfo | URL) => {
      const u = typeof url === 'string' ? url : url.toString();
      if (u.includes('platform-status')) {
        probeCount++;
        return new Response(JSON.stringify({ configured: true }), { status: 200 });
      }
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });

    const { platformApiFetch } = await freshModule();
    await platformApiFetch('/api/v1/a');
    await platformApiFetch('/api/v1/b');
    await platformApiFetch('/api/v1/c');
    expect(probeCount).toBe(1);
  });
});
