/**
 * Tests for platformApiFetch() state machine logic using fetch mocks.
 * We reset the module between groups that test different probe responses,
 * because configuredProbe is a module-level singleton.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeFetch(responses: Array<{ ok: boolean; status?: number; body?: unknown }>) {
  let call = 0;
  return vi.fn().mockImplementation(() => {
    const r = responses[call++] ?? responses[responses.length - 1];
    return Promise.resolve({
      ok: r.ok,
      status: r.status ?? (r.ok ? 200 : 500),
      json: () => Promise.resolve(r.body ?? {}),
      text: () => Promise.resolve(String(r.body ?? '')),
    });
  });
}

// ─── when backend is NOT configured ──────────────────────────────────────────

describe('platformApiFetch — backend not configured', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns state=unavailable when /api/platform-status says configured:false', async () => {
    global.fetch = makeFetch([
      // probe call
      { ok: true, body: { configured: false } },
    ]) as unknown as typeof fetch;

    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/anything');
    expect(result.state).toBe('unavailable');
  });

  it('returns state=unavailable when probe fetch throws', async () => {
    global.fetch = vi.fn().mockRejectedValueOnce(new Error('network error')) as unknown as typeof fetch;

    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/anything');
    expect(result.state).toBe('unavailable');
  });
});

// ─── when backend IS configured ──────────────────────────────────────────────

describe('platformApiFetch — backend configured and ok', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns state=ok with parsed data when backend returns 200', async () => {
    global.fetch = makeFetch([
      // probe
      { ok: true, body: { configured: true } },
      // actual request
      { ok: true, body: { renders: [] } },
    ]) as unknown as typeof fetch;

    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch<{ renders: unknown[] }>('/api/v1/renders');
    expect(result.state).toBe('ok');
    if (result.state === 'ok') {
      expect(result.data).toEqual({ renders: [] });
    }
  });

  it('returns state=not_found for 404', async () => {
    global.fetch = makeFetch([
      { ok: true, body: { configured: true } },
      { ok: false, status: 404, body: {} },
    ]) as unknown as typeof fetch;

    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/renders/nonexistent');
    expect(result.state).toBe('not_found');
  });

  it('returns state=error with detail message for non-200/non-404', async () => {
    global.fetch = makeFetch([
      { ok: true, body: { configured: true } },
      { ok: false, status: 500, body: { detail: 'Server exploded' } },
    ]) as unknown as typeof fetch;

    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/renders');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toContain('Server exploded');
    }
  });

  it('returns state=error with status fallback when body has no detail', async () => {
    global.fetch = makeFetch([
      { ok: true, body: { configured: true } },
      { ok: false, status: 503, body: {} },
    ]) as unknown as typeof fetch;

    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/renders');
    expect(result.state).toBe('error');
    if (result.state === 'error') {
      expect(result.message).toContain('503');
    }
  });

  it('returns state=unreachable when configured but fetch to path throws', async () => {
    let call = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      if (call++ === 0) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ configured: true }) });
      }
      return Promise.reject(new Error('connection refused'));
    }) as unknown as typeof fetch;

    const { platformApiFetch } = await import('@/lib/platform-api');
    const result = await platformApiFetch('/api/v1/renders');
    expect(result.state).toBe('unreachable');
    if (result.state === 'unreachable') {
      expect(result.message).toContain('connection refused');
    }
  });
});

// ─── probe caching ───────────────────────────────────────────────────────────

describe('platformApiFetch — probe memoization', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('only calls /api/platform-status once for multiple requests', async () => {
    const fetchMock = makeFetch([
      { ok: true, body: { configured: true } },
      { ok: true, body: { result: 1 } },
      { ok: true, body: { result: 2 } },
    ]);
    global.fetch = fetchMock as unknown as typeof fetch;

    const { platformApiFetch } = await import('@/lib/platform-api');
    await platformApiFetch('/api/v1/a');
    await platformApiFetch('/api/v1/b');

    // first call = probe, second + third = actual requests
    expect(fetchMock).toHaveBeenCalledTimes(3);
    // The very first call must be the probe
    expect((fetchMock.mock.calls[0] as string[])[0]).toContain('platform-status');
  });
});
