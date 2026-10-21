import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('TavilyRateLimitError', () => {
  it('has the correct name', async () => {
    const { TavilyRateLimitError } = await import('@/lib/tavily');
    const err = new TavilyRateLimitError(30);
    expect(err.name).toBe('TavilyRateLimitError');
  });

  it('stores retryAfterSeconds', async () => {
    const { TavilyRateLimitError } = await import('@/lib/tavily');
    const err = new TavilyRateLimitError(60);
    expect(err.retryAfterSeconds).toBe(60);
  });

  it('handles null retryAfterSeconds', async () => {
    const { TavilyRateLimitError } = await import('@/lib/tavily');
    const err = new TavilyRateLimitError(null);
    expect(err.retryAfterSeconds).toBeNull();
  });

  it('is an instance of Error', async () => {
    const { TavilyRateLimitError } = await import('@/lib/tavily');
    const err = new TavilyRateLimitError(null);
    expect(err).toBeInstanceOf(Error);
  });

  it('has the correct message', async () => {
    const { TavilyRateLimitError } = await import('@/lib/tavily');
    const err = new TavilyRateLimitError(null);
    expect(err.message).toBe('Tavily rate limit exceeded');
  });
});

describe('extractUrlContent()', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.TAVILY_API_KEY;
  });

  afterEach(() => {
    delete process.env.TAVILY_API_KEY;
    vi.restoreAllMocks();
  });

  it('throws when TAVILY_API_KEY is not set', async () => {
    const { extractUrlContent } = await import('@/lib/tavily');
    await expect(extractUrlContent('https://example.com')).rejects.toThrow('TAVILY_API_KEY is not configured.');
  });

  it('throws TavilyRateLimitError on 429 without Retry-After', async () => {
    process.env.TAVILY_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 429,
      ok: false,
      headers: { get: () => null },
    }));
    const { extractUrlContent, TavilyRateLimitError } = await import('@/lib/tavily');
    await expect(extractUrlContent('https://tiktok.com/@user/video/1')).rejects.toBeInstanceOf(TavilyRateLimitError);
  });

  it('throws TavilyRateLimitError on 429 with Retry-After header', async () => {
    process.env.TAVILY_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 429,
      ok: false,
      headers: { get: (h: string) => (h === 'retry-after' ? '45' : null) },
    }));
    const { extractUrlContent, TavilyRateLimitError } = await import('@/lib/tavily');
    try {
      await extractUrlContent('https://example.com');
    } catch (e) {
      expect(e).toBeInstanceOf(TavilyRateLimitError);
      expect((e as InstanceType<typeof TavilyRateLimitError>).retryAfterSeconds).toBe(45);
    }
  });

  it('throws on non-OK non-429 response', async () => {
    process.env.TAVILY_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 500,
      ok: false,
      headers: { get: () => null },
      text: async () => 'Internal Server Error',
    }));
    const { extractUrlContent } = await import('@/lib/tavily');
    await expect(extractUrlContent('https://example.com')).rejects.toThrow('Tavily extract failed (500)');
  });

  it('throws when results array is empty', async () => {
    process.env.TAVILY_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: { get: () => null },
      json: async () => ({ results: [], failed_results: [{ url: 'x', error: 'blocked' }] }),
    }));
    const { extractUrlContent } = await import('@/lib/tavily');
    await expect(extractUrlContent('https://example.com')).rejects.toThrow('blocked');
  });

  it('returns the first result on success', async () => {
    process.env.TAVILY_API_KEY = 'test-key';
    const mockResult = { url: 'https://example.com', title: 'Test', raw_content: 'Content here' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: { get: () => null },
      json: async () => ({ results: [mockResult], failed_results: [] }),
    }));
    const { extractUrlContent } = await import('@/lib/tavily');
    const result = await extractUrlContent('https://example.com');
    expect(result).toEqual(mockResult);
  });

  it('sends Authorization header with Bearer token', async () => {
    process.env.TAVILY_API_KEY = 'my-tavily-key';
    let capturedInit: RequestInit | undefined;
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      capturedInit = init;
      return Promise.resolve({
        status: 200,
        ok: true,
        headers: { get: () => null },
        json: async () => ({ results: [{ url: 'u', raw_content: 'c' }], failed_results: [] }),
      });
    }));
    const { extractUrlContent } = await import('@/lib/tavily');
    await extractUrlContent('https://example.com');
    const headers = capturedInit?.headers as Record<string, string>;
    expect(headers?.['Authorization']).toBe('Bearer my-tavily-key');
  });
});

describe('searchTopics()', () => {
  beforeEach(() => {
    vi.resetModules();
    delete process.env.TAVILY_API_KEY;
  });

  afterEach(() => {
    delete process.env.TAVILY_API_KEY;
    vi.restoreAllMocks();
  });

  it('throws when TAVILY_API_KEY is not set', async () => {
    const { searchTopics } = await import('@/lib/tavily');
    await expect(searchTopics('fitness trends')).rejects.toThrow('TAVILY_API_KEY is not configured.');
  });

  it('throws TavilyRateLimitError on 429', async () => {
    process.env.TAVILY_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 429,
      ok: false,
      headers: { get: () => null },
    }));
    const { searchTopics, TavilyRateLimitError } = await import('@/lib/tavily');
    await expect(searchTopics('query')).rejects.toBeInstanceOf(TavilyRateLimitError);
  });

  it('returns results on success', async () => {
    process.env.TAVILY_API_KEY = 'test-key';
    const mockResults = [
      { url: 'https://a.com', title: 'A', content: 'Content A', score: 0.9 },
      { url: 'https://b.com', title: 'B', content: 'Content B', score: 0.8 },
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      headers: { get: () => null },
      json: async () => ({ results: mockResults }),
    }));
    const { searchTopics } = await import('@/lib/tavily');
    const result = await searchTopics('fitness trends');
    expect(result).toEqual(mockResults);
  });

  it('throws on non-OK response', async () => {
    process.env.TAVILY_API_KEY = 'test-key';
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 503,
      ok: false,
      headers: { get: () => null },
      text: async () => 'Service Unavailable',
    }));
    const { searchTopics } = await import('@/lib/tavily');
    await expect(searchTopics('query')).rejects.toThrow('Tavily search failed (503)');
  });

  it('passes maxResults to the API body', async () => {
    process.env.TAVILY_API_KEY = 'k';
    let capturedBody: Record<string, unknown> | undefined;
    vi.stubGlobal('fetch', vi.fn().mockImplementation((_url: string, init: RequestInit) => {
      capturedBody = JSON.parse(init.body as string) as Record<string, unknown>;
      return Promise.resolve({
        status: 200, ok: true,
        headers: { get: () => null },
        json: async () => ({ results: [] }),
      });
    }));
    const { searchTopics } = await import('@/lib/tavily');
    await searchTopics('test query', 5);
    expect(capturedBody?.max_results).toBe(5);
  });
});
