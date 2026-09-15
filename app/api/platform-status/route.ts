import { NextResponse } from 'next/server';

/**
 * Authoritative answer to "is the ViralVision platform service wired up?".
 *
 * The `/api/v1/:path*` rewrite in next.config.mjs only exists when
 * INTERNAL_API_URL is set. Client components can't read that, so without
 * this endpoint they have to infer it from a 404 — which is wrong the
 * moment the backend legitimately returns 404 for a missing record.
 *
 * Deliberately exposes only a boolean: the backend's actual origin is an
 * internal address and isn't the browser's business.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({ configured: Boolean(process.env.INTERNAL_API_URL) });
}
