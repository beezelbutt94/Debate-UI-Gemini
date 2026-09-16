'use client';

import { useSession } from '@clerk/nextjs';
import { createClient } from '@supabase/supabase-js';
import { useMemo } from 'react';

/**
 * RLS-scoped browser client, bound to the signed-in Clerk session's token
 * via the same native third-party auth integration as the server client
 * (see lib/supabase/server.ts). Memoized per session so components don't
 * reconstruct a client on every render.
 */
export function useSupabaseBrowserClient() {
  const { session } = useSession();

  return useMemo(
    () =>
      createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          accessToken: async () => session?.getToken() ?? null,
        }
      ),
    [session]
  );
}
