import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TavilyRateLimitError } from '@/lib/tavily';

// We re-import inside each test after setting up env + fetch mock
// because the module reads process.env.TAVILY_API_KEY at call time.

const mockFetch = vi.fn();

vi.stubGlobal('fetch', mockFetch);

function makeResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  const headerMap = new Map(Object.entries(headers));
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
    headers: { get: (k: string) => headerMap.get(k) ?? null },
  } as unknown as Response;
}

describe('extractUrlContent()', () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv, TAVILY_API_KEY: 'test-key' };
    mockFetch.mockReset();
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it('throws when TAVILY_API_KEY is missing', async () => {
    delete process.env.TAVILY_API_KEY;
    const { extractUrlContent } = await import('@/lib/tavily');
    await expect(extractUrlContent('https://example.com')).rejects.toThrow('TAVILY_API_KEY');
  });

  it('returns the first result on success', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({
        results: [{ url: 'https://example.com', title: 'Example', raw_content: 'Hello world' }],
        failed_results: [],
      })
    );
    const { extractUrlContent } = await import('@/lib/tavily');
    const result = await extractUrlContent('https://example.com');
    expect(result.url).toBe('https://example.com');
    expect(result.raw_content).toBe('Hello world');
  });

  it('throws TavilyRateLimitError on 429', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({}, 429, { 'retry-after': '60' }));
    const { extractUrlContent } = await import('@/lib/tavily');
    await expect(extractUrlContent('https://example.com')).rejects.toThrow(TavilyRateLimitError);
  });

  it('TavilyRateLimitError carries retryAfterSeconds', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({}, 429, { 'retry-after': '30' }));
    const { extractUrlContent } = await import('@/lib/tavily');
    let caught: TavilyRateLimitError | undefined;
    try {
      await extractUrlContent('https://example.com');
    } catch (e) {
      caught = e as TavilyRateLimitError;
    }
    expect(caught?.retryAfterSeconds).toBe(30);
  });

  it('TavilyRateLimitError has null retryAfterSeconds when no header', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({}, 429));
    const { extractUrlContent } = await import('@/lib/tavily');
    let caught: TavilyRateLimitError | undefined;
    try {
      await extractUrlContent('https://example.com');
    } catch (e) {
      caught = e as TavilyRateLimitError;
    }
    expect(caught?.retryAfterSeconds).toBeNull();
  });

  it('throws when results array is empty', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({
        results: [],
        failed_results: [{ url: 'https://example.com', error: 'Scraping failed' }],
      })
    );
    const { extractUrlContent } = await import('@/lib/tavily');
    await expect(extractUrlContent('https://example.com')).rejects.toThrow('Scraping failed');
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ message: 'Server error' }, 500));
    const { extractUrlContent } = await import('@/lib/tavily');
    await expect(extractUrlContent('https://example.com')).rejects.toThrow('500');
  });

  it('sends the correct Authorization header', async () => {
    mockFetch.mockResolvedValueOnce(
      makeResponse({ results: [{ url: 'u', raw_content: 'c' }], failed_results: [] })
    );
    const { extractUrlContent } = await import('@/lib/tavily');
    await extractUrlContent('https://example.com');
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer test-key');
  });
});

describe('searchTopics()', () => {
  const origEnv = process.env;

  beforeEach(() => {
    process.env = { ...origEnv, TAVILY_API_KEY: 'test-key' };
    mockFetch.mockReset();
  });

  afterEach(() => {
    process.env = origEnv;
  });

  it('throws when TAVILY_API_KEY is missing', async () => {
    delete process.env.TAVILY_API_KEY;
    const { searchTopics } = await import('@/lib/tavily');
    await expect(searchTopics('cooking')).rejects.toThrow('TAVILY_API_KEY');
  });

  it('returns results array on success', async () => {
    const mockResults = [
      { url: 'https://site1.com', title: 'Site 1', content: 'Content 1', score: 0.9 },
      { url: 'https://site2.com', title: 'Site 2', content: 'Content 2', score: 0.8 },
    ];
    mockFetch.mockResolvedValueOnce(makeResponse({ results: mockResults }));
    const { searchTopics } = await import('@/lib/tavily');
    const results = await searchTopics('cooking');
    expect(results).toHaveLength(2);
    expect(results[0].url).toBe('https://site1.com');
  });

  it('throws TavilyRateLimitError on 429', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({}, 429));
    const { searchTopics } = await import('@/lib/tavily');
    await expect(searchTopics('cooking')).rejects.toThrow(TavilyRateLimitError);
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ detail: 'Bad request' }, 400));
    const { searchTopics } = await import('@/lib/tavily');
    await expect(searchTopics('cooking')).rejects.toThrow('400');
  });

  it('sends correct query in body', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ results: [] }));
    const { searchTopics } = await import('@/lib/tavily');
    await searchTopics('viral cooking');
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.query).toBe('viral cooking');
  });

  it('uses maxResults parameter', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ results: [] }));
    const { searchTopics } = await import('@/lib/tavily');
    await searchTopics('query', 5);
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.max_results).toBe(5);
  });

  it('defaults to 8 max results', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse({ results: [] }));
    const { searchTopics } = await import('@/lib/tavily');
    await searchTopics('query');
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    expect(body.max_results).toBe(8);
  });
});

describe('TavilyRateLimitError', () => {
  it('is an instance of Error', () => {
    expect(new TavilyRateLimitError(10)).toBeInstanceOf(Error);
  });

  it('has name "TavilyRateLimitError"', () => {
    expect(new TavilyRateLimitError(10).name).toBe('TavilyRateLimitError');
  });

  it('stores retryAfterSeconds', () => {
    expect(new TavilyRateLimitError(60).retryAfterSeconds).toBe(60);
    expect(new TavilyRateLimitError(null).retryAfterSeconds).toBeNull();
  });

  it('has a descriptive message', () => {
    expect(new TavilyRateLimitError(30).message).toContain('rate limit');
  });
});
