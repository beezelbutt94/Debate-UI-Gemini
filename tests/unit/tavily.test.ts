import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractUrlContent, searchTopics, TavilyRateLimitError } from '@/lib/tavily';

// ── helpers ───────────────────────────────────────────────────────────────────

function mockFetch(status: number, body: unknown, headers: Record<string, string> = {}) {
  const responseHeaders = new Headers(headers);
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    headers: responseHeaders,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response);
}

const origEnv = { ...process.env };

beforeEach(() => {
  process.env.TAVILY_API_KEY = 'test-key';
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...origEnv };
});

// ── extractUrlContent ─────────────────────────────────────────────────────────

describe('extractUrlContent', () => {
  const sampleResult = { url: 'https://tiktok.com/@u/v/1', raw_content: 'some content', title: 'Vid' };

  it('returns the first result on success', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { results: [sampleResult], failed_results: [] }));
    const result = await extractUrlContent('https://tiktok.com/@u/v/1');
    expect(result).toEqual(sampleResult);
  });

  it('POSTs to the Tavily extract endpoint', async () => {
    const fetchMock = mockFetch(200, { results: [sampleResult], failed_results: [] });
    vi.stubGlobal('fetch', fetchMock);
    await extractUrlContent('https://tiktok.com/@u/v/1');
    const [calledUrl, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain('tavily.com/extract');
    expect(init.method).toBe('POST');
  });

  it('sends Authorization header with the API key', async () => {
    const fetchMock = mockFetch(200, { results: [sampleResult], failed_results: [] });
    vi.stubGlobal('fetch', fetchMock);
    await extractUrlContent('https://url.com');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)?.Authorization).toBe('Bearer test-key');
  });

  it('throws TavilyRateLimitError on 429', async () => {
    vi.stubGlobal('fetch', mockFetch(429, {}, { 'retry-after': '30' }));
    await expect(extractUrlContent('https://url.com')).rejects.toBeInstanceOf(TavilyRateLimitError);
  });

  it('surfaces retryAfterSeconds from the Retry-After header', async () => {
    vi.stubGlobal('fetch', mockFetch(429, {}, { 'retry-after': '45' }));
    try {
      await extractUrlContent('https://url.com');
    } catch (e) {
      expect((e as TavilyRateLimitError).retryAfterSeconds).toBe(45);
    }
  });

  it('sets retryAfterSeconds=null when no Retry-After header', async () => {
    vi.stubGlobal('fetch', mockFetch(429, {}));
    try {
      await extractUrlContent('https://url.com');
    } catch (e) {
      expect((e as TavilyRateLimitError).retryAfterSeconds).toBeNull();
    }
  });

  it('throws on non-OK status', async () => {
    vi.stubGlobal('fetch', mockFetch(500, { error: 'server error' }));
    await expect(extractUrlContent('https://url.com')).rejects.toThrow(/500/);
  });

  it('throws when results array is empty', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { results: [], failed_results: [{ url: 'x', error: 'not found' }] }));
    await expect(extractUrlContent('https://url.com')).rejects.toThrow(/not found/);
  });

  it('throws when results array is empty and failed_results is also empty', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { results: [], failed_results: [] }));
    await expect(extractUrlContent('https://url.com')).rejects.toThrow(/no content returned/);
  });

  it('throws when TAVILY_API_KEY is not set', async () => {
    delete process.env.TAVILY_API_KEY;
    await expect(extractUrlContent('https://url.com')).rejects.toThrow(/TAVILY_API_KEY/);
  });
});

// ── searchTopics ──────────────────────────────────────────────────────────────

describe('searchTopics', () => {
  const sampleResults = [
    { url: 'https://a.com', title: 'A', content: 'content a', score: 0.9 },
    { url: 'https://b.com', title: 'B', content: 'content b', score: 0.7 },
  ];

  it('returns results array on success', async () => {
    vi.stubGlobal('fetch', mockFetch(200, { results: sampleResults }));
    const res = await searchTopics('viral video tips');
    expect(res).toEqual(sampleResults);
  });

  it('POSTs to the Tavily search endpoint', async () => {
    const fetchMock = mockFetch(200, { results: sampleResults });
    vi.stubGlobal('fetch', fetchMock);
    await searchTopics('query');
    const [calledUrl] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(calledUrl).toContain('tavily.com/search');
  });

  it('sends Authorization header', async () => {
    const fetchMock = mockFetch(200, { results: sampleResults });
    vi.stubGlobal('fetch', fetchMock);
    await searchTopics('query');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.headers as Record<string, string>)?.Authorization).toBe('Bearer test-key');
  });

  it('includes max_results in the body', async () => {
    const fetchMock = mockFetch(200, { results: sampleResults });
    vi.stubGlobal('fetch', fetchMock);
    await searchTopics('query', 5);
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.max_results).toBe(5);
  });

  it('defaults max_results to 8', async () => {
    const fetchMock = mockFetch(200, { results: sampleResults });
    vi.stubGlobal('fetch', fetchMock);
    await searchTopics('query');
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    const body = JSON.parse(init.body as string);
    expect(body.max_results).toBe(8);
  });

  it('throws TavilyRateLimitError on 429', async () => {
    vi.stubGlobal('fetch', mockFetch(429, {}, { 'retry-after': '60' }));
    await expect(searchTopics('query')).rejects.toBeInstanceOf(TavilyRateLimitError);
  });

  it('throws on non-OK status', async () => {
    vi.stubGlobal('fetch', mockFetch(503, {}));
    await expect(searchTopics('query')).rejects.toThrow(/503/);
  });

  it('throws when TAVILY_API_KEY is not set', async () => {
    delete process.env.TAVILY_API_KEY;
    await expect(searchTopics('query')).rejects.toThrow(/TAVILY_API_KEY/);
  });
});

// ── TavilyRateLimitError ──────────────────────────────────────────────────────

describe('TavilyRateLimitError', () => {
  it('is an instance of Error', () => {
    expect(new TavilyRateLimitError(10)).toBeInstanceOf(Error);
  });

  it('has name TavilyRateLimitError', () => {
    expect(new TavilyRateLimitError(10).name).toBe('TavilyRateLimitError');
  });

  it('stores retryAfterSeconds', () => {
    expect(new TavilyRateLimitError(30).retryAfterSeconds).toBe(30);
    expect(new TavilyRateLimitError(null).retryAfterSeconds).toBeNull();
  });
});
