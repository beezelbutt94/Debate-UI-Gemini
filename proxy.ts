import { NextRequest, NextResponse } from 'next/server';

/**
 * Multi-tenant custom-domain routing for the ViralVision platform expansion
 * (see docs/PLATFORM_ROADMAP.md). Resolves a subdomain or white-labeled
 * custom domain to a tenant and rewrites to `/_tenants/[tenantId]/...`.
 *
 * Disabled by default (`NextResponse.next()` on every request) so it can't
 * break the existing ViralSync app's routing until multi-tenancy is
 * actually wanted -- flip `MULTI_TENANT_ROUTING_ENABLED=true` to turn it on,
 * and set `NEXT_PUBLIC_ROOT_DOMAIN` to your real apex domain first, or every
 * request will look like an unregistered tenant.
 */

interface TenantResolutionRecord {
  tenantId: string;
  slug: string;
  customDomain?: string | null;
  tier: 'standard' | 'pro' | 'enterprise';
  status: 'active' | 'suspended';
}

const CACHE_TTL_MS = 60 * 1000;
const hostResolutionCache = new Map<string, { record: TenantResolutionRecord | null; expiresAt: number }>();

async function resolveTenantRecord(hostname: string): Promise<TenantResolutionRecord | null> {
  const now = Date.now();
  const cached = hostResolutionCache.get(hostname);
  if (cached && cached.expiresAt > now) {
    return cached.record;
  }

  const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (upstashUrl && upstashToken) {
    try {
      const redisRes = await fetch(`${upstashUrl}/get/domain:${hostname}`, {
        headers: { Authorization: `Bearer ${upstashToken}` },
        cache: 'no-store',
      });
      if (redisRes.ok) {
        const { result } = await redisRes.json();
        if (result) {
          const parsed: TenantResolutionRecord = JSON.parse(result);
          hostResolutionCache.set(hostname, { record: parsed, expiresAt: now + CACHE_TTL_MS });
          return parsed;
        }
      }
    } catch (err) {
      console.error(`[middleware] Edge Redis lookup error for host ${hostname}:`, err);
    }
  }

  const internalApiUrl = process.env.INTERNAL_API_URL;
  const edgeSecret = process.env.EDGE_INTERNAL_SECRET;
  if (internalApiUrl && edgeSecret) {
    try {
      const res = await fetch(
        `${internalApiUrl}/api/v1/workspace/resolve-domain?host=${encodeURIComponent(hostname)}`,
        { headers: { 'X-Edge-Auth-Secret': edgeSecret }, next: { revalidate: 60 } }
      );
      if (res.ok) {
        const data: TenantResolutionRecord = await res.json();
        hostResolutionCache.set(hostname, { record: data, expiresAt: now + CACHE_TTL_MS });
        return data;
      }
    } catch (err) {
      console.error(`[middleware] Backend lookup failed for host ${hostname}:`, err);
    }
  }

  hostResolutionCache.set(hostname, { record: null, expiresAt: now + 15 * 1000 });
  return null;
}

export async function proxy(req: NextRequest) {
  if (process.env.MULTI_TENANT_ROUTING_ENABLED !== 'true') {
    return NextResponse.next();
  }

  const url = req.nextUrl;
  const rawHost = req.headers.get('host') || '';
  const hostname = rawHost.toLowerCase().split(':')[0];
  const { pathname, search } = url;

  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.includes('.')) {
    return NextResponse.next();
  }

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost';
  const isRootApex =
    hostname === rootDomain || hostname === `www.${rootDomain}` || hostname === 'localhost';

  if (isRootApex) {
    return NextResponse.next();
  }

  let resolvedTenant: TenantResolutionRecord | null = null;
  if (hostname.endsWith(`.${rootDomain}`)) {
    const slug = hostname.replace(`.${rootDomain}`, '');
    if (slug && slug !== 'www' && slug !== 'app') {
      resolvedTenant = await resolveTenantRecord(slug);
    }
  } else {
    resolvedTenant = await resolveTenantRecord(hostname);
  }

  if (!resolvedTenant || resolvedTenant.status !== 'active') {
    const errorUrl = req.nextUrl.clone();
    errorUrl.pathname = '/domain-unregistered';
    errorUrl.searchParams.set('host', hostname);
    return NextResponse.rewrite(errorUrl);
  }

  const rewrittenUrl = new URL(
    `/_tenants/${resolvedTenant.tenantId}${pathname === '/' ? '' : pathname}${search}`,
    req.url
  );

  const response = NextResponse.rewrite(rewrittenUrl);
  response.headers.set('x-tenant-id', resolvedTenant.tenantId);
  response.headers.set('x-tenant-slug', resolvedTenant.slug);
  response.headers.set('x-tenant-tier', resolvedTenant.tier);
  response.headers.set('x-forwarded-host', rawHost);
  return response;
}

export const config = {
  matcher: ['/((?!api/|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'],
};
