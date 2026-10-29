import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// platform-api.ts memoises the probe with a module-level variable, so we need
// to clear and re-import the module for each test group.
const fetchMock = vi.fn();

vi.stubGlobal('fetch', fetchMock);

// Helper to reset module cache so isPlatformConfigured()'s memo is cleared.
async function freshImport() {
  vi.resetModules();
  return import('@/lib/platform-api');
}

beforeEach(() => {
  fetchMock.mockReset();
});

afterEach(() => {
  vi.resetModules();
});

// ─── state: unavailable (platform not configured) ─────────────────────────────

describe('platformApiFetch() – unavailable (probe returns configured: false)', () => {
  it('returns { state: "unavailable" } when probe says not configured', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ configured: false }),
    });

    const { platformApiFetch } = await freshImport();
    const result = await platformApiFetch('/api/v1/test');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns { state: "unavailable" } when probe request itself rejects', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network failure'));

    const { platformApiFetch } = await freshImport();
    const result = await platformApiFetch('/api/v1/test');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns { state: "unavailable" } when probe HTTP response is not ok', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ configured: false }),
    });

    const { platformApiFetch } = await freshImport();
    const result = await platformApiFetch('/api/v1/test');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns { state: "unavailable" } when probe returns object without configured key', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const { platformApiFetch } = await freshImport();
    const result = await platformApiFetch('/api/v1/test');
    expect(result).toEqual({ state: 'unavailable' });
  });
});

// ─── state: unreachable ────────────────────────────────────────────────────────

describe('platformApiFetch() – unreachable (probe ok, actual request throws)', () => {
  it('returns { state: "unreachable" } with the error message', async () => {
    // probe succeeds
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ configured: true }),
    });
    // actual request throws
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const { platformApiFetch } = await freshImport();
    const result = await platformApiFetch('/api/v1/test');
    expect(result).toEqual({ state: 'unreachable', message: 'ECONNREFUSED' });
  });
});

// ─── state: not_found ─────────────────────────────────────────────────────────

describe('platformApiFetch() – not_found (404 from backend)', () => {
  it('returns { state: "not_found" } on 404', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ configured: true }),
    });
    fetchMock.mockResolvedValueOnce({ ok: false, status: 404 });

    const { platformApiFetch } = await freshImport();
    const result = await platformApiFetch('/api/v1/missing');
    expect(result).toEqual({ state: 'not_found' });
  });
});

// ─── state: error ─────────────────────────────────────────────────────────────

describe('platformApiFetch() – error (non-404 non-ok response)', () => {
  it('returns { state: "error", message } on 500 with JSON detail', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ configured: true }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ detail: 'Internal server error' }),
    });

    const { platformApiFetch } = await freshImport();
    const result = await platformApiFetch('/api/v1/fail');
    expect(result).toEqual({ state: 'error', message: 'Internal server error' });
  });

  it('falls back to status-code message when body has no detail', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ configured: true }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => ({}),
    });

    const { platformApiFetch } = await freshImport();
    const result = await platformApiFetch('/api/v1/fail');
    expect(result).toEqual({ state: 'error', message: 'Request failed (503)' });
  });

  it('falls back to status-code message when body is not JSON', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ configured: true }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: async () => { throw new SyntaxError('not json'); },
    });

    const { platformApiFetch } = await freshImport();
    const result = await platformApiFetch('/api/v1/fail');
    expect(result).toEqual({ state: 'error', message: 'Request failed (503)' });
  });
});

// ─── state: ok ────────────────────────────────────────────────────────────────

describe('platformApiFetch() – ok (2xx response)', () => {
  it('returns { state: "ok", data } on successful response', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ configured: true }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: 'abc', name: 'test' }),
    });

    const { platformApiFetch } = await freshImport();
    const result = await platformApiFetch<{ id: string; name: string }>('/api/v1/resource');
    expect(result).toEqual({ state: 'ok', data: { id: 'abc', name: 'test' } });
  });

  it('passes init options to the actual fetch call', async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ configured: true }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });

    const { platformApiFetch } = await freshImport();
    await platformApiFetch('/api/v1/resource', { method: 'POST' });

    // The second call should be the actual resource fetch with method POST
    const secondCall = fetchMock.mock.calls[1];
    expect(secondCall[0]).toBe('/api/v1/resource');
    expect(secondCall[1]).toMatchObject({ method: 'POST' });
  });
});
