const TAVILY_EXTRACT_URL = 'https://api.tavily.com/extract';

export interface TavilyExtractResult {
  url: string;
  title?: string;
  raw_content: string;
}

export interface TavilyExtractResponse {
  results: TavilyExtractResult[];
  failed_results: { url: string; error: string }[];
}

export class TavilyRateLimitError extends Error {
  constructor(public retryAfterSeconds: number | null) {
    super('Tavily rate limit exceeded');
    this.name = 'TavilyRateLimitError';
  }
}

/**
 * Extracts rendered page content for one URL via Tavily's /extract API
 * (https://api.tavily.com/extract). Response shape confirmed live against
 * a real TikTok/YouTube Shorts/Facebook Reels-style URL: {results: [{url,
 * title, raw_content}], failed_results: [...]}.
 *
 * A 15s AbortController timeout keeps a slow/hanging scrape from pinning a
 * serverless invocation open indefinitely; a 429 response is surfaced as a
 * typed TavilyRateLimitError carrying Retry-After so the route handler can
 * propagate it to the client instead of masking it as a generic failure.
 */
export async function extractUrlContent(url: string): Promise<TavilyExtractResult> {
  if (!process.env.TAVILY_API_KEY) {
    throw new Error('TAVILY_API_KEY is not configured.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  let res: Response;
  try {
    res = await fetch(TAVILY_EXTRACT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.TAVILY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        urls: [url],
        extract_depth: 'advanced',
        format: 'markdown',
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (res.status === 429) {
    const retryAfter = res.headers.get('retry-after');
    throw new TavilyRateLimitError(retryAfter ? Number(retryAfter) : null);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Tavily extract failed (${res.status}): ${body.slice(0, 500)}`);
  }

  const data = (await res.json()) as TavilyExtractResponse;

  if (data.results.length === 0) {
    const reason = data.failed_results[0]?.error ?? 'no content returned';
    throw new Error(`Tavily could not extract this URL: ${reason}`);
  }

  return data.results[0];
}
