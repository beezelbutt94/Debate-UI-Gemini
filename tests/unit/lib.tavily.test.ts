import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TavilyRateLimitError, extractUrlContent, searchTopics } from '@/lib/tavily';

// ─── TavilyRateLimitError ─────────────────────────────────────────────────────

describe('TavilyRateLimitError', () => {
  it('is an instance of Error', () => {
    expect(new TavilyRateLimitError(null)).toBeInstanceOf(Error);
  });

  it('has name "TavilyRateLimitError"', () => {
    expect(new TavilyRateLimitError(null).name).toBe('TavilyRateLimitError');
  });

  it('has the standard rate-limit message', () => {
    expect(new TavilyRateLimitError(null).message).toBe('Tavily rate limit exceeded');
  });

  it('stores null retryAfterSeconds', () => {
    expect(new TavilyRateLimitError(null).retryAfterSeconds).toBeNull();
  });

  it('stores numeric retryAfterSeconds', () => {
    expect(new TavilyRateLimitError(30).retryAfterSeconds).toBe(30);
  });

  it('stores zero retryAfterSeconds', () => {
    expect(new TavilyRateLimitError(0).retryAfterSeconds).toBe(0);
  });
});

// ─── Shared fetch-mock helpers ────────────────────────────────────────────────

function makeResponse(overrides: {
  ok: boolean;
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
  textBody?: string;
}): Response {
  const headers = new Headers(overrides.headers ?? {});
  return {
    ok: overrides.ok,
    status: overrides.status ?? (overrides.ok ? 200 : 500),
    headers,
    json: async () => overrides.body,
    text: async () => overrides.textBody ?? JSON.stringify(overrides.body ?? ''),
  } as unknown as Response;
}

beforeEach(() => {
  process.env.TAVILY_API_KEY = 'test-tavily-key';
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  delete process.env.TAVILY_API_KEY;
});

// ─── extractUrlContent ────────────────────────────────────────────────────────

describe('extractUrlContent()', () => {
  it('throws when TAVILY_API_KEY is not set', async () => {
    delete process.env.TAVILY_API_KEY;
    await expect(extractUrlContent('https://example.com')).rejects.toThrow('TAVILY_API_KEY');
  });

  it('returns the first result on a successful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeResponse({
          ok: true,
          body: {
            results: [{ url: 'https://example.com', title: 'Example', raw_content: 'page text' }],
            failed_results: [],
          },
        })
      )
    );

    const result = await extractUrlContent('https://example.com');
    expect(result.url).toBe('https://example.com');
    expect(result.raw_content).toBe('page text');
    vi.unstubAllGlobals();
  });

  it('throws TavilyRateLimitError on a 429 without Retry-After', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeResponse({ ok: false, status: 429 }))
    );
    await expect(extractUrlContent('https://example.com')).rejects.toBeInstanceOf(TavilyRateLimitError);
    vi.unstubAllGlobals();
  });

  it('throws TavilyRateLimitError with parsed Retry-After seconds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeResponse({ ok: false, status: 429, headers: { 'retry-after': '60' } })
      )
    );
    const err = await extractUrlContent('https://example.com').catch((e) => e);
    expect(err).toBeInstanceOf(TavilyRateLimitError);
    expect((err as TavilyRateLimitError).retryAfterSeconds).toBe(60);
    vi.unstubAllGlobals();
  });

  it('throws a generic error on a non-429 non-ok response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeResponse({ ok: false, status: 500, textBody: 'server error' }))
    );
    await expect(extractUrlContent('https://example.com')).rejects.toThrow('500');
    vi.unstubAllGlobals();
  });

  it('throws when results array is empty (URL could not be extracted)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeResponse({
          ok: true,
          body: {
            results: [],
            failed_results: [{ url: 'https://example.com', error: 'blocked' }],
          },
        })
      )
    );
    await expect(extractUrlContent('https://example.com')).rejects.toThrow('blocked');
    vi.unstubAllGlobals();
  });

  it('throws with fallback message when results empty and no failed_results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeResponse({ ok: true, body: { results: [], failed_results: [] } })
      )
    );
    await expect(extractUrlContent('https://example.com')).rejects.toThrow(
      'no content returned'
    );
    vi.unstubAllGlobals();
  });

  it('sends the correct Authorization header', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeResponse({
        ok: true,
        body: {
          results: [{ url: 'https://x.com', raw_content: 'x' }],
          failed_results: [],
        },
      })
    );
    vi.stubGlobal('fetch', mockFetch);
    await extractUrlContent('https://x.com');
    const [, init] = mockFetch.mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer test-tavily-key',
    });
    vi.unstubAllGlobals();
  });
});

// ─── searchTopics ─────────────────────────────────────────────────────────────

describe('searchTopics()', () => {
  it('throws when TAVILY_API_KEY is not set', async () => {
    delete process.env.TAVILY_API_KEY;
    await expect(searchTopics('productivity')).rejects.toThrow('TAVILY_API_KEY');
  });

  it('returns the results array on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        makeResponse({
          ok: true,
          body: {
            results: [
              { url: 'https://a.com', title: 'A', content: 'article a', score: 0.9 },
              { url: 'https://b.com', title: 'B', content: 'article b', score: 0.8 },
            ],
          },
        })
      )
    );
    const results = await searchTopics('productivity');
    expect(results).toHaveLength(2);
    expect(results[0].url).toBe('https://a.com');
    vi.unstubAllGlobals();
  });

  it('throws TavilyRateLimitError on a 429', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeResponse({ ok: false, status: 429 }))
    );
    await expect(searchTopics('query')).rejects.toBeInstanceOf(TavilyRateLimitError);
    vi.unstubAllGlobals();
  });

  it('throws a generic error on non-ok non-429', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(makeResponse({ ok: false, status: 503, textBody: 'unavailable' }))
    );
    await expect(searchTopics('query')).rejects.toThrow('503');
    vi.unstubAllGlobals();
  });

  it('passes max_results to the request body', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeResponse({ ok: true, body: { results: [] } })
    );
    vi.stubGlobal('fetch', mockFetch);
    await searchTopics('query', 5);
    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.max_results).toBe(5);
    vi.unstubAllGlobals();
  });

  it('defaults to max_results=8', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeResponse({ ok: true, body: { results: [] } })
    );
    vi.stubGlobal('fetch', mockFetch);
    await searchTopics('query');
    const [, init] = mockFetch.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.max_results).toBe(8);
    vi.unstubAllGlobals();
  });

  it('sends the correct Authorization header', async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      makeResponse({ ok: true, body: { results: [] } })
    );
    vi.stubGlobal('fetch', mockFetch);
    await searchTopics('query');
    const [, init] = mockFetch.mock.calls[0];
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer test-tavily-key',
    });
    vi.unstubAllGlobals();
  });
});
