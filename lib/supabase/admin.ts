import { createClient } from '@supabase/supabase-js';

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
    { auth: { persistSession: false } }
  );
}
