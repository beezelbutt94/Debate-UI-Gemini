import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Each test resets the module so the memoised configuredProbe is cleared.
// Fresh import + fresh fetch stub = isolated test.
beforeEach(() => {
  vi.resetModules();
  vi.unstubAllGlobals();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function stubFetch(...responses: Partial<Response>[]) {
  const mock = vi.fn();
  for (const r of responses) {
    mock.mockResolvedValueOnce(r);
  }
  vi.stubGlobal('fetch', mock);
  return mock;
}

async function load() {
  const mod = await import('@/lib/platform-api');
  return mod.platformApiFetch;
}

// ── unavailable ───────────────────────────────────────────────────────────────

describe('platformApiFetch() – unavailable', () => {
  it('returns unavailable when platform-status says configured:false', async () => {
    stubFetch({ ok: true, json: async () => ({ configured: false }) } as Response);
    const fn = await load();
    expect(await fn('/api/renders/1')).toEqual({ state: 'unavailable' });
  });

  it('returns unavailable when platform-status returns non-ok response', async () => {
    stubFetch({ ok: false, json: async () => ({}) } as Response);
    const fn = await load();
    expect(await fn('/api/renders/1')).toEqual({ state: 'unavailable' });
  });

  it('returns unavailable when platform-status fetch throws (network error)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));
    const fn = await load();
    expect(await fn('/api/renders/1')).toEqual({ state: 'unavailable' });
  });

  it('returns unavailable when platform-status body has no configured field', async () => {
    stubFetch({ ok: true, json: async () => ({}) } as Response);
    const fn = await load();
    expect(await fn('/api/renders/1')).toEqual({ state: 'unavailable' });
  });
});

// ── ok ────────────────────────────────────────────────────────────────────────

describe('platformApiFetch() – ok', () => {
  it('returns ok with parsed JSON data on a 200', async () => {
    stubFetch(
      { ok: true, json: async () => ({ configured: true }) } as Response,
      { ok: true, status: 200, json: async () => ({ id: '42', name: 'clip' }) } as Response
    );
    const fn = await load();
    const result = await fn('/api/renders/42');
    expect(result).toEqual({ state: 'ok', data: { id: '42', name: 'clip' } });
  });
});

// ── not_found ─────────────────────────────────────────────────────────────────

describe('platformApiFetch() – not_found', () => {
  it('returns not_found on a 404', async () => {
    stubFetch(
      { ok: true, json: async () => ({ configured: true }) } as Response,
      { ok: false, status: 404 } as Response
    );
    const fn = await load();
    expect(await fn('/api/renders/999')).toEqual({ state: 'not_found' });
  });
});

// ── unreachable ───────────────────────────────────────────────────────────────

describe('platformApiFetch() – unreachable', () => {
  it('returns unreachable with the error message when the actual request throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ configured: true }) } as Response)
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
    );
    const fn = await load();
    const result = await fn('/api/renders/1');
    expect(result).toEqual({ state: 'unreachable', message: 'ECONNREFUSED' });
  });
});

// ── error ─────────────────────────────────────────────────────────────────────

describe('platformApiFetch() – error', () => {
  it('returns error with status-code message for a 500 without JSON detail', async () => {
    stubFetch(
      { ok: true, json: async () => ({ configured: true }) } as Response,
      { ok: false, status: 500, json: async () => ({}) } as Response
    );
    const fn = await load();
    const result = (await fn('/api/renders/1')) as { state: string; message: string };
    expect(result.state).toBe('error');
    expect(result.message).toContain('500');
  });

  it('returns error with the detail string from the JSON body', async () => {
    stubFetch(
      { ok: true, json: async () => ({ configured: true }) } as Response,
      {
        ok: false,
        status: 503,
        json: async () => ({ detail: 'Service temporarily unavailable' }),
      } as Response
    );
    const fn = await load();
    const result = (await fn('/api/renders/1')) as { state: string; message: string };
    expect(result.state).toBe('error');
    expect(result.message).toBe('Service temporarily unavailable');
  });

  it('falls back to status-code message when JSON body throws on parse', async () => {
    stubFetch(
      { ok: true, json: async () => ({ configured: true }) } as Response,
      {
        ok: false,
        status: 502,
        json: async () => { throw new SyntaxError('not json'); },
      } as Response
    );
    const fn = await load();
    const result = (await fn('/api/renders/1')) as { state: string; message: string };
    expect(result.state).toBe('error');
    expect(result.message).toContain('502');
  });
});
