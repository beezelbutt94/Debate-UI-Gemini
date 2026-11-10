import { describe, it, expect } from 'vitest';
import { domainOf, dedupeByDomain } from '@/lib/discover-utils';
import type { TavilySearchResult } from '@/lib/tavily';

describe('domainOf()', () => {
  it('returns hostname without www prefix', () => {
    expect(domainOf('https://www.example.com/path')).toBe('example.com');
  });

  it('returns hostname for a URL without www', () => {
    expect(domainOf('https://example.com/path')).toBe('example.com');
  });

  it('strips www from subdomain of subdomain', () => {
    expect(domainOf('https://www.blog.example.com')).toBe('blog.example.com');
  });

  it('preserves non-www subdomains', () => {
    expect(domainOf('https://docs.example.com/guide')).toBe('docs.example.com');
  });

  it('works with http scheme', () => {
    expect(domainOf('http://example.com')).toBe('example.com');
  });

  it('ignores path and query string', () => {
    expect(domainOf('https://example.com/a/b/c?foo=bar&baz=1')).toBe('example.com');
  });

  it('ignores fragment identifier', () => {
    expect(domainOf('https://example.com/page#section')).toBe('example.com');
  });

  it('handles URL with port', () => {
    expect(domainOf('https://example.com:8080/path')).toBe('example.com');
  });

  it('returns null for a non-URL string', () => {
    expect(domainOf('not a url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(domainOf('')).toBeNull();
  });

  it('returns null for a bare hostname without scheme', () => {
    expect(domainOf('example.com')).toBeNull();
  });

  it('returns null for a relative path', () => {
    expect(domainOf('/relative/path')).toBeNull();
  });

  it('handles a URL with only a domain and trailing slash', () => {
    expect(domainOf('https://example.com/')).toBe('example.com');
  });

  it('handles IP addresses', () => {
    expect(domainOf('http://192.168.1.1/path')).toBe('192.168.1.1');
  });

  it('handles deep nested path', () => {
    expect(domainOf('https://www.news.ycombinator.com/item?id=123')).toBe('news.ycombinator.com');
  });
});

describe('dedupeByDomain()', () => {
  const makeResult = (url: string, score: number, title = 'Title'): TavilySearchResult => ({
    url,
    title,
    content: 'content',
    score,
  });

  it('returns empty array for empty input', () => {
    expect(dedupeByDomain([])).toEqual([]);
  });

  it('keeps single result as-is', () => {
    const results = [makeResult('https://example.com/a', 0.9)];
    const out = dedupeByDomain(results);
    expect(out).toHaveLength(1);
    expect(out[0].url).toBe('https://example.com/a');
    expect(out[0].domain).toBe('example.com');
  });

  it('keeps highest-scoring result per domain', () => {
    const results = [
      makeResult('https://example.com/a', 0.5),
      makeResult('https://example.com/b', 0.9),
      makeResult('https://example.com/c', 0.3),
    ];
    const out = dedupeByDomain(results);
    expect(out).toHaveLength(1);
    expect(out[0].url).toBe('https://example.com/b');
    expect(out[0].score).toBe(0.9);
  });

  it('keeps one entry per domain when multiple domains appear', () => {
    const results = [
      makeResult('https://alpha.com/1', 0.8),
      makeResult('https://beta.com/1', 0.6),
      makeResult('https://alpha.com/2', 0.5),
      makeResult('https://gamma.com/1', 0.7),
    ];
    const out = dedupeByDomain(results);
    const domains = out.map((r) => r.domain);
    expect(domains).toContain('alpha.com');
    expect(domains).toContain('beta.com');
    expect(domains).toContain('gamma.com');
    expect(out).toHaveLength(3);
  });

  it('sorts results by score descending', () => {
    const results = [
      makeResult('https://low.com', 0.2),
      makeResult('https://high.com', 0.9),
      makeResult('https://mid.com', 0.5),
    ];
    const out = dedupeByDomain(results);
    expect(out[0].score).toBeGreaterThanOrEqual(out[1].score);
    expect(out[1].score).toBeGreaterThanOrEqual(out[2].score);
  });

  it('attaches domain field to each result', () => {
    const results = [makeResult('https://www.example.com/page', 1.0)];
    const out = dedupeByDomain(results);
    expect(out[0].domain).toBe('example.com');
  });

  it('strips www when computing the domain key', () => {
    const results = [
      makeResult('https://www.example.com/a', 0.9),
      makeResult('https://example.com/b', 0.6),
    ];
    const out = dedupeByDomain(results);
    expect(out).toHaveLength(1);
    expect(out[0].score).toBe(0.9);
  });

  it('skips results with unparseable URLs', () => {
    const results = [
      makeResult('not-a-url', 0.9),
      makeResult('https://valid.com/page', 0.5),
    ];
    const out = dedupeByDomain(results);
    expect(out).toHaveLength(1);
    expect(out[0].domain).toBe('valid.com');
  });

  it('skips all results when all URLs are invalid', () => {
    const results = [
      makeResult('bad-url', 0.9),
      makeResult('also bad', 0.5),
    ];
    expect(dedupeByDomain(results)).toEqual([]);
  });

  it('preserves original result fields (title, content, score)', () => {
    const results = [makeResult('https://example.com', 0.75, 'My Title')];
    results[0].content = 'some content here';
    const out = dedupeByDomain(results);
    expect(out[0].title).toBe('My Title');
    expect(out[0].content).toBe('some content here');
    expect(out[0].score).toBe(0.75);
  });

  it('handles a large batch of results across many domains', () => {
    const results = Array.from({ length: 50 }, (_, i) =>
      makeResult(`https://site${i % 10}.com/page${i}`, Math.random())
    );
    const out = dedupeByDomain(results);
    expect(out).toHaveLength(10);
    const domains = new Set(out.map((r) => r.domain));
    expect(domains.size).toBe(10);
  });

  it('result is sorted descending even when tie scores exist', () => {
    const results = [
      makeResult('https://a.com', 0.5),
      makeResult('https://b.com', 0.5),
    ];
    const out = dedupeByDomain(results);
    expect(out).toHaveLength(2);
    expect(out[0].score).toBe(0.5);
    expect(out[1].score).toBe(0.5);
  });
});
