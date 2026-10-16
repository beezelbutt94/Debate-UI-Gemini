/**
 * Tests for platformApiFetch and the isPlatformConfigured probe.
 *
 * lib/platform-api.ts stores `configuredProbe` at module scope so it is only
 * probed once per page load. Tests that need a fresh probe therefore call
 * vi.resetModules() + dynamic import('@/lib/platform-api') to get a clean
 * module instance before each test.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Build minimal Response-like objects that work in Node
function makeJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function makePlainResponse(text: string, status: number): Response {
  return new Response(text, { status });
}

describe('platformApiFetch', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
  });

  async function freshImport(fetchImpl: typeof fetch) {
    vi.stubGlobal('fetch', fetchImpl);
    const mod = await import('@/lib/platform-api');
    return mod.platformApiFetch;
  }

  it('returns { state: "unavailable" } when platform-status says not configured', async () => {
    let callCount = 0;
    const fetchMock = vi.fn(async () => {
      callCount++;
      return makeJsonResponse({ configured: false });
    });
    const platformApiFetch = await freshImport(fetchMock as unknown as typeof fetch);
    const result = await platformApiFetch('/api/v1/data');
    expect(result.state).toBe('unavailable');
  });

  it('returns { state: "unavailable" } when platform-status fetch throws', async () => {
    const fetchMock = vi.fn(async () => { throw new Error('network error'); });
    const platformApiFetch = await freshImport(fetchMock as unknown as typeof fetch);
    const result = await platformApiFetch('/api/v1/data');
    expect(result.state).toBe('unavailable');
  });

  it('returns { state: "ok", data } on a successful 200 response', async () => {
    let probed = false;
    const fetchMock = vi.fn(async (url: string | Request | URL) => {
      const path = typeof url === 'string' ? url : url.toString();
      if (!probed && path.includes('platform-status')) {
        probed = true;
        return makeJsonResponse({ configured: true });
      }
      return makeJsonResponse({ id: 'abc', name: 'test' });
    });
    const platformApiFetch = await freshImport(fetchMock as unknown as typeof fetch);
    const result = await platformApiFetch<{ id: string; name: string }>('/api/v1/data');
    expect(result.state).toBe('ok');
    if (result.state === 'ok') {
      expect(result.data).toEqual({ id: 'abc', name: 'test' });
    }
  });

  it('returns { state: "not_found" } on a 404 response', async () => {
    let probed = false;
    const fetchMock = vi.fn(async (url: string | Request | URL) => {
      const path = typeof url === 'string' ? url : url.toString();
      if (!probed && path.includes('platform-status')) {
        probed = true;
        return makeJsonResponse({ configured: true });
      }
      return makeJsonResponse({}, 404);
    });
    const platformApiFetch = await freshImport(fetchMock as unknown as typeof fetch);
    const result = await platformApiFetch('/api/v1/missing');
    expect(result.state).toBe('not_found');
  });

  it('returns { state: "error" } with detail message on a 500 response', async () => {
    let probed = false;
    const fetchMock = vi.fn(async (url: string | Request | URL) => {
      const path = typeof url === 'string' ? url : url.toString();
      if (!probed && path.includes('platform-status')) {
        probed = true;
        return makeJsonResponse({ configured: true });
      }
      return makeJsonResponse({ detail: 'Server blew up' }, 500);
    });
    const platformApiFetch = await freshImport(fetchMock as unknown as typeof fetch);
    const result = await platformApiFetch('/api/v1/broken');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toBe('Server blew up');
    }
  });

  it('returns { state: "error" } with status code when body is non-JSON', async () => {
    let probed = false;
    const fetchMock = vi.fn(async (url: string | Request | URL) => {
      const path = typeof url === 'string' ? url : url.toString();
      if (!probed && path.includes('platform-status')) {
        probed = true;
        return makeJsonResponse({ configured: true });
      }
      return makePlainResponse('plain text error', 503);
    });
    const platformApiFetch = await freshImport(fetchMock as unknown as typeof fetch);
    const result = await platformApiFetch('/api/v1/plain-error');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toContain('503');
    }
  });

  it('returns { state: "unreachable" } when configured but actual fetch throws', async () => {
    let probed = false;
    const fetchMock = vi.fn(async (url: string | Request | URL) => {
      const path = typeof url === 'string' ? url : url.toString();
      if (!probed && path.includes('platform-status')) {
        probed = true;
        return makeJsonResponse({ configured: true });
      }
      throw new Error('ECONNREFUSED');
    });
    const platformApiFetch = await freshImport(fetchMock as unknown as typeof fetch);
    const result = await platformApiFetch('/api/v1/data');
    expect(result.state).toBe('unreachable');
    if (result.state === 'unreachable') {
      expect(result.message).toContain('ECONNREFUSED');
    }
  });

  it('returns { state: "error" } with a generic message when error body lacks detail', async () => {
    let probed = false;
    const fetchMock = vi.fn(async (url: string | Request | URL) => {
      const path = typeof url === 'string' ? url : url.toString();
      if (!probed && path.includes('platform-status')) {
        probed = true;
        return makeJsonResponse({ configured: true });
      }
      return makeJsonResponse({ other: 'field' }, 422);
    });
    const platformApiFetch = await freshImport(fetchMock as unknown as typeof fetch);
    const result = await platformApiFetch('/api/v1/bad-request');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toContain('422');
    }
  });
});
