import { createClient } from '@supabase/supabase-js';

/**
 * Next.js memoizes identical GET fetches within one server render pass
 * (node_modules/next/dist/docs/01-app/03-api-reference/04-functions/fetch.md,
 * "Memoization"). supabase-js reads are GET fetches, so a page that reads a
 * row, writes it, and reads it again (lib/account.ts does exactly this for a
 * brand-new user) would get the stale first result back. A fresh
 * AbortController signal opts a fetch out of memoization; no-store keeps it
 * out of the persistent data cache too. Database reads must always be live.
 */
const liveFetch: typeof fetch = (input, init) =>
  fetch(input, { ...init, cache: 'no-store', signal: init?.signal ?? new AbortController().signal });

/**
 * Service-role client. Bypasses RLS — only ever import this from
 * trusted server code with no user-controlled input (e.g. the Stripe
 * webhook handler, which has already verified the event signature).
 * Never expose SUPABASE_SERVICE_ROLE_KEY to the client bundle.
 */
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false }, global: { fetch: liveFetch } }
  );
}
