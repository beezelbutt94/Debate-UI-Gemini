import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { consumeQuotaOrRespond, refundQuota } from '@/lib/quota';
import { logEvent } from '@/lib/events';
import { errorStatus, publicErrorMessage } from '@/lib/errors';
import { searchTopics, TavilyRateLimitError, type TavilySearchResult } from '@/lib/tavily';
import { generateSiteDiscovery } from '@/lib/anthropic';
import type { AuditReportRow, SiteDiscoveryResult } from '@/lib/types';

const MAX_QUERY_LENGTH = 300;
const MIN_UNIQUE_DOMAINS = 3;
const SEARCH_MAX_RESULTS = 20;

interface DiscoverRequestBody {
  query?: string;
}

function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

/** Keeps the highest-scoring result per domain so 10 slots aren't wasted on one site. */
function dedupeByDomain(results: TavilySearchResult[]): (TavilySearchResult & { domain: string })[] {
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

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  let body: DiscoverRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  const query = typeof body.query === 'string' ? body.query.trim() : '';
  if (!query) {
    return NextResponse.json({ error: '"query" is required.' }, { status: 400 });
  }
  if (query.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: `"query" must be ${MAX_QUERY_LENGTH} characters or fewer.` }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  const quotaDenied = await consumeQuotaOrRespond(admin, userId, 'discover');
  if (quotaDenied) return quotaDenied;

  try {
    const rawResults = await searchTopics(query, SEARCH_MAX_RESULTS);
    const candidates = dedupeByDomain(rawResults);

    if (candidates.length < MIN_UNIQUE_DOMAINS) {
      throw new Error(
        `Only found ${candidates.length} distinct site(s) for that query -- not enough to build a top-10 with a real outlier.`
      );
    }

    const searchDigest = candidates
      .map((c, i) => `${i + 1}. "${c.title}" (${c.url})\n${c.content.slice(0, 500)}`)
      .join('\n\n');

    const generated = await generateSiteDiscovery({ query, searchDigest });

    const candidateUrls = new Set(candidates.map((c) => c.url));
    const sites = generated.sites.filter((s) => candidateUrls.has(s.url));
    if (sites.length === 0) {
      throw new Error('Anthropic did not return any site drawn from the real search results.');
    }
    if (!sites.some((s) => s.url === generated.outlier.url)) {
      throw new Error('Anthropic named an outlier that is not one of its own returned sites.');
    }

    const analysis: SiteDiscoveryResult = {
      query,
      sites: sites.map((s) => ({ ...s, domain: domainOf(s.url) ?? s.url })),
      outlier: generated.outlier,
      summary: generated.summary,
    };

    const { data: report, error: insertError } = await admin
      .from('audit_reports')
      .insert({
        user_id: userId,
        creator_profile_id: null,
        source_type: 'discovery',
        source_url: null,
        platform: null,
        viral_score: null,
        analysis,
        timeline_recommendations: [],
      })
      .select()
      .single();

    if (insertError || !report) {
      console.error('audit_reports insert failed', insertError);
      await refundQuota(admin, userId, 'discover');
      return NextResponse.json({ error: 'Could not save the discovery report.' }, { status: 500 });
    }

    return NextResponse.json({ report: report as AuditReportRow<SiteDiscoveryResult> }, { status: 200 });
  } catch (err) {
    await refundQuota(admin, userId, 'discover');

    if (err instanceof TavilyRateLimitError) {
      return NextResponse.json(
        { error: 'The scraping service is rate-limited right now. Please try again shortly.' },
        {
          status: 429,
          headers: err.retryAfterSeconds ? { 'Retry-After': String(err.retryAfterSeconds) } : undefined,
        }
      );
    }

    await logEvent('error', 'discover.failed', { userId, error: err });
    return NextResponse.json(
      { error: publicErrorMessage(err, 'Web discovery failed. It did not count against your plan; please try again.') },
      { status: errorStatus(err) }
    );
  }
}
