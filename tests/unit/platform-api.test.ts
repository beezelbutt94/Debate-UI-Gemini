/**
 * Tests for lib/platform-api.ts
 *
 * platformApiFetch uses a module-level memoized Promise (`configuredProbe`)
 * that caches the /api/platform-status result for the lifetime of a page
 * load. In Node.js tests we reset the module between test cases by
 * dynamically importing it with a cache-busting query string. This keeps
 * each describe block isolated without needing jest.resetModules or
 * similar.
 *
 * We override the global `fetch` before each import to control what
 * /api/platform-status and the target path return.
 */
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// --- Helpers ---

type FetchResponder = (url: string, init?: RequestInit) => Response | Promise<Response>;

function installFetch(handler: FetchResponder) {
  (globalThis as Record<string, unknown>).fetch = (url: string, init?: RequestInit) => {
    try {
      return Promise.resolve(handler(url, init));
    } catch (err) {
      return Promise.reject(err);
    }
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function textResponse(body: string, status: number): Response {
  return new Response(body, { status });
}

/** Import platform-api with a fresh module (bypasses Node's module cache). */
async function freshImport() {
  const ts = Date.now() + Math.random();
  // Node.js --experimental-strip-types supports ?query param cache-bust for dynamic imports
  const { platformApiFetch } = await import(
    `../../lib/platform-api.ts?t=${ts}`
  );
  return platformApiFetch as <T>(path: string, init?: RequestInit) => Promise<unknown>;
}

// -----------------------------------------------------------------------

describe('platformApiFetch – unavailable (platform not configured)', () => {
  test('returns { state: "unavailable" } when /api/platform-status says configured=false', async () => {
    installFetch((url) => {
      if (url.includes('platform-status')) return jsonResponse({ configured: false });
      return jsonResponse({}, 200);
    });

    const fetch_ = await freshImport();
    const result = await fetch_('/api/v1/renders/123') as { state: string };
    assert.equal(result.state, 'unavailable');
  });

  test('returns { state: "unavailable" } when /api/platform-status returns non-ok', async () => {
    installFetch((url) => {
      if (url.includes('platform-status')) return jsonResponse({}, 500);
      return jsonResponse({}, 200);
    });

    const fetch_ = await freshImport();
    const result = await fetch_('/api/v1/renders/123') as { state: string };
    assert.equal(result.state, 'unavailable');
  });

  test('returns { state: "unavailable" } when /api/platform-status fetch throws', async () => {
    installFetch((url) => {
      if (url.includes('platform-status')) throw new Error('network error');
      return jsonResponse({}, 200);
    });

    const fetch_ = await freshImport();
    const result = await fetch_('/api/v1/renders/123') as { state: string };
    assert.equal(result.state, 'unavailable');
  });
});

describe('platformApiFetch – configured, various responses', () => {
  test('returns { state: "ok", data } on 200 response', async () => {
    installFetch((url) => {
      if (url.includes('platform-status')) return jsonResponse({ configured: true });
      return jsonResponse({ id: 'render-1', status: 'done' });
    });

    const fetch_ = await freshImport();
    const result = await fetch_<{ id: string; status: string }>('/api/v1/renders/1') as { state: string; data: { id: string } };
    assert.equal(result.state, 'ok');
    assert.equal(result.data.id, 'render-1');
  });

  test('returns { state: "not_found" } on 404', async () => {
    installFetch((url) => {
      if (url.includes('platform-status')) return jsonResponse({ configured: true });
      return jsonResponse({ detail: 'not found' }, 404);
    });

    const fetch_ = await freshImport();
    const result = await fetch_('/api/v1/renders/missing') as { state: string };
    assert.equal(result.state, 'not_found');
  });

  test('returns { state: "error", message } on 500 with JSON detail', async () => {
    installFetch((url) => {
      if (url.includes('platform-status')) return jsonResponse({ configured: true });
      return jsonResponse({ detail: 'Internal server error' }, 500);
    });

    const fetch_ = await freshImport();
    const result = await fetch_('/api/v1/renders/bad') as { state: string; message: string };
    assert.equal(result.state, 'error');
    assert.ok(result.message.includes('Internal server error'));
  });

  test('returns { state: "error", message } on 400 with no JSON body', async () => {
    installFetch((url) => {
      if (url.includes('platform-status')) return jsonResponse({ configured: true });
      return textResponse('Bad request', 400);
    });

    const fetch_ = await freshImport();
    const result = await fetch_('/api/v1/renders/bad') as { state: string; message: string };
    assert.equal(result.state, 'error');
    assert.ok(result.message.includes('400'));
  });

  test('returns { state: "unreachable", message } when configured but fetch throws', async () => {
    let firstCall = true;
    installFetch((url) => {
      if (url.includes('platform-status')) return jsonResponse({ configured: true });
      if (firstCall) {
        firstCall = false;
        throw new Error('ECONNREFUSED');
      }
      return jsonResponse({}, 200);
    });

    const fetch_ = await freshImport();
    const result = await fetch_('/api/v1/renders/bad') as { state: string; message: string };
    assert.equal(result.state, 'unreachable');
    assert.ok(result.message.includes('ECONNREFUSED'));
  });

  test('returns { state: "error" } on 422 with detail field', async () => {
    installFetch((url) => {
      if (url.includes('platform-status')) return jsonResponse({ configured: true });
      return jsonResponse({ detail: 'Validation error' }, 422);
    });

    const fetch_ = await freshImport();
    const result = await fetch_('/api/v1/renders/bad') as { state: string; message: string };
    assert.equal(result.state, 'error');
    assert.ok(result.message.includes('Validation error'));
  });
});
