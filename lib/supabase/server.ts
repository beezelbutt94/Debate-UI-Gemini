import { auth } from '@clerk/nextjs/server';
import { createClient } from '@supabase/supabase-js';

/**
 * RLS-scoped server client for the current request. Uses Supabase's native
 * third-party auth integration with Clerk: Clerk issues the session JWT,
 * Supabase validates it against Clerk's JWKS (configured once in the
 * Supabase dashboard under Authentication -> Third Party Auth), and every
 * `auth.jwt()->>'sub'` in an RLS policy resolves to the Clerk user id. No
 * Supabase Auth session or cookie handling is involved — Clerk owns the
 * session entirely.
 */
export function createSupabaseServerClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      async accessToken() {
        return (await auth()).getToken();
      },
    }
  );
}
