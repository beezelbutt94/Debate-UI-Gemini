import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Next.js 16 renamed the `middleware.ts` file convention to `proxy.ts`
 * (a single file may export only one proxy function) — see
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md.
 * This file therefore does two unrelated things in one exported function:
 *
 * 1. Clerk auth gating for ViralEngine itself (reachable without a
 *    session: the marketing root, Clerk's own auth pages, and the two
 *    signature-verified webhook endpoints; everything else under
 *    /dashboard or /api requires a signed-in user).
 * 2. The pre-existing, disabled-by-default multi-tenant custom-domain
 *    routing for the separate ViralVision platform expansion (see
 *    docs/PLATFORM_ROADMAP.md) — unchanged from before, still gated
 *    behind MULTI_TENANT_ROUTING_ENABLED so it can't affect ViralEngine's
 *    routing until multi-tenancy is actually wanted.
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
      console.error(`[proxy] Edge Redis lookup error for host ${hostname}:`, err);
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
      console.error(`[proxy] Backend lookup failed for host ${hostname}:`, err);
    }
  }

  hostResolutionCache.set(hostname, { record: null, expiresAt: now + 15 * 1000 });
  return null;
}

async function applyTenantRouting(req: NextRequest): Promise<NextResponse | undefined> {
  if (process.env.MULTI_TENANT_ROUTING_ENABLED !== 'true') {
    return undefined;
  }

  const url = req.nextUrl;
  const rawHost = req.headers.get('host') || '';
  const hostname = rawHost.toLowerCase().split(':')[0];
  const { pathname, search } = url;

  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.includes('.')) {
    return undefined;
  }

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost';
  const isRootApex =
    hostname === rootDomain || hostname === `www.${rootDomain}` || hostname === 'localhost';

  if (isRootApex) {
    return undefined;
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

// Reachable without authentication: the marketing/dashboard root, Clerk's
// own auth pages, the two signature-verified webhook endpoints (Clerk and
// Stripe never send a session, they send a svix/stripe signature), and the
// cron publish trigger (Vercel Cron / an external scheduler never sends a
// Clerk session either -- it authenticates with CRON_SECRET as a bearer
// token, checked inside app/api/cron/publish/route.ts itself).
const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks/clerk',
  '/api/webhooks/stripe',
  '/api/cron/(.*)',
]);

// Everything else under /dashboard or /api requires a signed-in user.
const isProtectedRoute = createRouteMatcher(['/dashboard(.*)', '/api/(.*)']);

export const proxy = clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req) && isProtectedRoute(req)) {
    const { userId, redirectToSignIn } = await auth();
    if (!userId) {
      // API routes are consumed by fetch()/curl/Postman, which expect a
      // JSON error, not an HTML sign-in page behind a redirect. Only
      // /dashboard page routes get the redirect.
      if (req.nextUrl.pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
      }
      return redirectToSignIn();
    }
  }

  return (await applyTenantRouting(req)) ?? NextResponse.next();
});

// Clerk's recommended matcher (run on every route except static files and
// Next internals, always run on API routes) — a superset of the old
// tenant-routing matcher, which is still enforced inside applyTenantRouting.
export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
