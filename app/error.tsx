'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

/**
 * Shown when a page throws while rendering. The message stays generic: the
 * real error is in the server logs (and `digest` ties the two together),
 * never on screen, where it could expose internals.
 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md text-center space-y-4">
        <h1 className="text-2xl font-black">Something went wrong</h1>
        <p className="text-sm text-neutral-400">
          This page hit an unexpected error. Please try again; if it keeps happening, contact support
          {error.digest ? ` and mention reference ${error.digest}` : ''}.
        </p>
        <div className="flex justify-center gap-2">
          <Button onClick={reset} className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold">
            Try again
          </Button>
          <Link href="/dashboard" prefetch={false} className="inline-flex h-10 items-center rounded-lg border border-neutral-800 px-4 text-sm hover:bg-neutral-900">
            Go to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
