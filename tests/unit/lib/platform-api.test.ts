import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TOOL_INFO } from '@/lib/tool-suite';

// ─── TOOL_INFO ────────────────────────────────────────────────────────────────

describe('TOOL_INFO', () => {
  const expectedTools = ['descript', 'opusclip', 'hyperframes', 'canva'] as const;

  it('contains all four expected tools', () => {
    for (const tool of expectedTools) {
      expect(TOOL_INFO).toHaveProperty(tool);
    }
  });

  it.each(expectedTools)('%s has a non-empty label', (tool) => {
    expect(TOOL_INFO[tool].label.length).toBeGreaterThan(0);
  });

  it.each(expectedTools)('%s has a valid URL', (tool) => {
    expect(() => new URL(TOOL_INFO[tool].url)).not.toThrow();
    expect(TOOL_INFO[tool].url.startsWith('https://')).toBe(true);
  });

  it.each(expectedTools)('%s has a non-empty specialty description', (tool) => {
    expect(TOOL_INFO[tool].specialty.length).toBeGreaterThan(0);
  });

  it('descript label is "Descript"', () => {
    expect(TOOL_INFO.descript.label).toBe('Descript');
  });

  it('opusclip URL points to opus.pro', () => {
    expect(new URL(TOOL_INFO.opusclip.url).hostname).toContain('opus.pro');
  });

  it('hyperframes URL points to heygen.com', () => {
    expect(new URL(TOOL_INFO.hyperframes.url).hostname).toContain('heygen.com');
  });

  it('canva URL points to canva.com', () => {
    expect(new URL(TOOL_INFO.canva.url).hostname).toContain('canva.com');
  });

  it('descript specialty mentions audio', () => {
    expect(TOOL_INFO.descript.specialty.toLowerCase()).toContain('audio');
  });
});

// ─── platformApiFetch ─────────────────────────────────────────────────────────
// We need to test the client-side helper without running a real server.
// We reset the module between tests because configuredProbe is memoised at
// module level — re-importing resets it.

describe('platformApiFetch()', () => {
  let platformApiFetch: (path: string, init?: RequestInit) => Promise<unknown>;

  beforeEach(async () => {
    vi.resetModules();
    // Re-import after resetModules so the module-level cache is fresh
    const mod = await import('@/lib/platform-api');
    platformApiFetch = mod.platformApiFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns { state: "unavailable" } when /api/platform-status returns configured:false', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (String(url).includes('platform-status')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ configured: false }) });
      }
      throw new Error('unexpected fetch');
    }));

    const result = await platformApiFetch('/api/v1/some-resource');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns { state: "unavailable" } when /api/platform-status fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('network error'))));

    const result = await platformApiFetch('/api/v1/some-resource');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns { state: "unavailable" } when /api/platform-status returns non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (String(url).includes('platform-status')) {
        return Promise.resolve({ ok: false, json: () => Promise.resolve({}) });
      }
      throw new Error('unexpected fetch');
    }));

    const result = await platformApiFetch('/api/v1/some-resource');
    expect(result).toEqual({ state: 'unavailable' });
  });

  it('returns { state: "ok", data: ... } when platform is configured and request succeeds', async () => {
    const payload = { id: 1, name: 'test' };
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (String(url).includes('platform-status')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ configured: true }) });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(payload),
      });
    }));

    const result = await platformApiFetch('/api/v1/some-resource');
    expect(result).toEqual({ state: 'ok', data: payload });
  });

  it('returns { state: "not_found" } on 404', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (String(url).includes('platform-status')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ configured: true }) });
      }
      return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({}) });
    }));

    const result = await platformApiFetch('/api/v1/missing');
    expect(result).toEqual({ state: 'not_found' });
  });

  it('returns { state: "error", message: ... } on 500 with JSON detail', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (String(url).includes('platform-status')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ configured: true }) });
      }
      return Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ detail: 'Internal Server Error' }),
      });
    }));

    const result = await platformApiFetch('/api/v1/broken') as { state: string; message: string };
    expect(result.state).toBe('error');
    expect(result.message).toContain('Internal Server Error');
  });

  it('returns { state: "error", message: "Request failed (400)" } on 400 without JSON detail', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (String(url).includes('platform-status')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ configured: true }) });
      }
      return Promise.resolve({
        ok: false,
        status: 400,
        json: () => Promise.reject(new Error('non-JSON')),
      });
    }));

    const result = await platformApiFetch('/api/v1/bad') as { state: string; message: string };
    expect(result.state).toBe('error');
    expect(result.message).toContain('400');
  });

  it('returns { state: "unreachable", message: ... } when backend is configured but fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn((url: string) => {
      if (String(url).includes('platform-status')) {
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ configured: true }) });
      }
      return Promise.reject(new Error('ECONNREFUSED'));
    }));

    const result = await platformApiFetch('/api/v1/resource') as { state: string; message: string };
    expect(result.state).toBe('unreachable');
    expect(result.message).toContain('ECONNREFUSED');
  });
});
