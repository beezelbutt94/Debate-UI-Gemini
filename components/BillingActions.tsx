'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorNotice } from '@/components/ErrorNotice';
import type { PaidPlanTier } from '@/lib/plans';

async function redirectTo(endpoint: string, body?: unknown): Promise<string> {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let payload: { url?: string; error?: string } = {};
  try {
    payload = await res.json();
  } catch {
    // Non-JSON error page (proxy/timeout): fall through to the generic message.
  }
  if (!res.ok || !payload.url) {
    throw new Error(payload.error ?? `Something went wrong (${res.status}). Please try again.`);
  }
  return payload.url;
}

/** Upgrade button for one paid plan: starts Stripe Checkout. */
export function UpgradeButton({ plan, label, disabled }: { plan: PaidPlanTier; label: string; disabled?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      window.location.assign(await redirectTo('/api/stripe/checkout', { plan }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout.');
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        onClick={start}
        disabled={busy || disabled}
        className="w-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold"
      >
        {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-label="Opening checkout" /> : label}
      </Button>
      {error && <ErrorNotice message={error} />}
    </div>
  );
}

/** Opens the Stripe customer portal (change plan, cancel, card, invoices). */
export function ManageBillingButton({ label = 'Manage billing', variant = 'outline' }: { label?: string; variant?: 'outline' | 'default' }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function open() {
    setBusy(true);
    setError(null);
    try {
      window.location.assign(await redirectTo('/api/stripe/portal'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open billing management.');
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button onClick={open} disabled={busy} variant={variant} className="w-full sm:w-auto">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" aria-label="Opening billing" /> : label}
      </Button>
      {error && <ErrorNotice message={error} />}
    </div>
  );
}
