import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import { QUOTA_EXCEEDED_MESSAGE } from '@/lib/plans';

/** The standard inline error box, with an upgrade link when the quota ran out. */
export function ErrorNotice({ message }: { message: string }) {
  const quota = message === QUOTA_EXCEEDED_MESSAGE;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 p-4 rounded-xl border border-rose-900 bg-rose-950/40 text-rose-200 text-xs"
    >
      <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden />
      <div className="space-y-2">
        <p>{message}</p>
        {quota && (
          <Link
            href="/dashboard/billing"
            className="inline-flex items-center rounded-lg bg-amber-500 px-3 py-1.5 font-bold text-neutral-950 hover:bg-amber-400"
          >
            See plans
          </Link>
        )}
      </div>
    </div>
  );
}
