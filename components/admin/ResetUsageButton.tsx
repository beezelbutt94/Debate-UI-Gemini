'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Admin action: give a user their full allowance back for this period. */
export function ResetUsageButton({ userId, disabled }: { userId: string; disabled?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'confirm' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  async function reset() {
    setState('busy');
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/reset-usage`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `Failed (${res.status})`);
      setState('done');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed.');
      setState('idle');
    }
  }

  if (state === 'done') return <span className="text-[11px] text-emerald-400">Usage reset</span>;

  return (
    <div className="inline-flex flex-col items-end gap-1">
      {state === 'confirm' ? (
        <span className="inline-flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={reset}>
            Confirm reset
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setState('idle')}>
            Cancel
          </Button>
        </span>
      ) : (
        <Button size="sm" variant="outline" disabled={disabled || state === 'busy'} onClick={() => setState('confirm')}>
          {state === 'busy' ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-label="Resetting" /> : 'Reset usage'}
        </Button>
      )}
      {error && <span className="text-[11px] text-rose-300">{error}</span>}
    </div>
  );
}
