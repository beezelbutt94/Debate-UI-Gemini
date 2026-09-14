'use client';

import { useState } from 'react';
import type { CampaignLog, UserRow } from '@/lib/types';

const PLANS = [
  { id: 'starter', label: 'Starter', price: '€49/mo', credits: '50k views' },
  { id: 'pro', label: 'Pro', price: '€149/mo', credits: '200k views' },
  { id: 'agency', label: 'Agency', price: '€499/mo', credits: '1M views' },
] as const;

const DEFAULT_CREDIT_REQUEST = 1000;

export default function Dashboard({
  user,
  campaigns: initialCampaigns,
}: {
  user: UserRow;
  campaigns: CampaignLog[];
}) {
  const [url, setUrl] = useState('');
  const [credits, setCredits] = useState(DEFAULT_CREDIT_REQUEST);
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [activeCredits, setActiveCredits] = useState(user.active_credits);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, credits }),
      });
      const body = await res.json();
      if (res.status === 402) {
        setMessage('Not enough credits for this request. Upgrade your plan below.');
      } else if (!res.ok) {
        setMessage(body.error ?? 'Something went wrong.');
      } else {
        setCampaigns((prev) => [body.campaign, ...prev]);
        setActiveCredits((prev) => prev - credits);
        setUrl('');
        setMessage('Campaign submitted.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpgrade(plan: (typeof PLANS)[number]['id']) {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    });
    const body = await res.json();
    if (body.url) window.location.href = body.url;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-8 px-4 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">ViralSync</h1>
        <div className="rounded-full bg-brand-50 px-4 py-1 text-sm font-medium text-brand-700 dark:bg-neutral-900 dark:text-brand-500">
          {activeCredits.toLocaleString()} credits
        </div>
      </header>

      <section>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="url"
            required
            placeholder="Paste a TikTok or YouTube link"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
          <input
            type="number"
            min={1}
            value={credits}
            onChange={(e) => setCredits(Number(e.target.value))}
            className="w-28 rounded-md border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Amplify'}
          </button>
        </form>
        {message && <p className="mt-2 text-sm text-neutral-500">{message}</p>}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">
          Recent campaigns
        </h2>
        <ul className="flex flex-col gap-2">
          {campaigns.length === 0 && (
            <li className="text-sm text-neutral-500">No campaigns yet.</li>
          )}
          {campaigns.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-md border border-neutral-200 px-3 py-2 text-sm dark:border-neutral-800"
            >
              <span className="truncate">{c.pasted_url}</span>
              <span className="ml-3 shrink-0 text-neutral-500">
                {c.credits_charged.toLocaleString()} · {c.status}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">
          Plans
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.id}
              className="flex flex-col gap-2 rounded-md border border-neutral-200 p-4 dark:border-neutral-800"
            >
              <span className="font-medium">{p.label}</span>
              <span className="text-sm text-neutral-500">{p.price}</span>
              <span className="text-sm text-neutral-500">{p.credits}</span>
              <button
                onClick={() => handleUpgrade(p.id)}
                className="mt-2 rounded-md border border-brand-600 px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50 dark:hover:bg-neutral-900"
              >
                Choose {p.label}
              </button>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
