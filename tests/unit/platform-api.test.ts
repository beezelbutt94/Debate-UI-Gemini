import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// platform-api.ts memoises the probe at module level; reimport fresh each
// test by resetting the module registry between tests.
beforeEach(async () => {
  vi.resetModules();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Lazy import so that vi.resetModules() takes effect
async function importModule() {
  return await import('@/lib/platform-api');
}

function makeFetch(...responses: { ok: boolean; status: number; body: unknown }[]) {
  let call = 0;
  return vi.fn().mockImplementation(() => {
    const r = responses[call] ?? responses[responses.length - 1];
    call++;
    return Promise.resolve({
      ok: r.ok,
      status: r.status,
      json: () => Promise.resolve(r.body),
      text: () => Promise.resolve(JSON.stringify(r.body)),
    } as unknown as Response);
  });
}

describe('platformApiFetch', () => {
  it('returns { state: "unavailable" } when the probe reports not configured', async () => {
    vi.stubGlobal('fetch', makeFetch({ ok: true, status: 200, body: { configured: false } }));
    const { platformApiFetch } = await importModule();
    const result = await platformApiFetch('/api/some-path');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns { state: "unavailable" } when the probe fetch itself fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const { platformApiFetch } = await importModule();
    const result = await platformApiFetch('/api/some-path');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns { state: "ok", data } on a successful response', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetch(
        { ok: true, status: 200, body: { configured: true } }, // probe
        { ok: true, status: 200, body: { hello: 'world' } }    // real request
      )
    );
    const { platformApiFetch } = await importModule();
    const result = await platformApiFetch<{ hello: string }>('/api/renders/1');
    expect(result).toEqual({ state: 'ok', data: { hello: 'world' } });
  });

  it('returns { state: "not_found" } on 404', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetch(
        { ok: true, status: 200, body: { configured: true } },
        { ok: false, status: 404, body: {} }
      )
    );
    const { platformApiFetch } = await importModule();
    const result = await platformApiFetch('/api/renders/nonexistent');
    expect(result).toEqual({ state: 'not_found' });
  });

  it('returns { state: "error" } on a non-404 error status', async () => {
    vi.stubGlobal(
      'fetch',
      makeFetch(
        { ok: true, status: 200, body: { configured: true } },
        { ok: false, status: 500, body: { detail: 'Internal server error' } }
      )
    );
    const { platformApiFetch } = await importModule();
    const result = await platformApiFetch('/api/renders/1');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toContain('Internal server error');
    }
  });

  it('falls back to status-code message when error body is not JSON', async () => {
    let call = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      call++;
      if (call === 1) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ configured: true }) });
      }
      return Promise.resolve({
        ok: false,
        status: 502,
        json: () => Promise.reject(new Error('not json')),
        text: () => Promise.resolve('Bad Gateway'),
      });
    }));
    const { platformApiFetch } = await importModule();
    const result = await platformApiFetch('/api/renders/1');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toContain('502');
    }
  });

  it('returns { state: "unreachable" } when probe says configured but actual fetch throws', async () => {
    let call = 0;
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => {
      call++;
      if (call === 1) {
        return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ configured: true }) });
      }
      return Promise.reject(new Error('ECONNREFUSED'));
    }));
    const { platformApiFetch } = await importModule();
    const result = await platformApiFetch('/api/renders/1');
    expect(result.state).toBe('unreachable');
    if (result.state === 'unreachable') {
      expect(result.message).toContain('ECONNREFUSED');
    }
  });
});
