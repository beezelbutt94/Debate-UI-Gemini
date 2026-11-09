import type { TavilySearchResult } from '@/lib/tavily';

export function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** Keeps the highest-scoring result per domain so 10 slots aren't wasted on one site. */
export function dedupeByDomain(results: TavilySearchResult[]): (TavilySearchResult & { domain: string })[] {
  const byDomain = new Map<string, TavilySearchResult & { domain: string }>();
  for (const r of results) {
    const domain = domainOf(r.url);
    if (!domain) continue;
    const existing = byDomain.get(domain);
    if (!existing || r.score > existing.score) {
      byDomain.set(domain, { ...r, domain });
    }
  }
  return [...byDomain.values()].sort((a, b) => b.score - a.score);
}
