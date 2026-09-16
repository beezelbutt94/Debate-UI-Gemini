'use client';

import { useEffect, useState } from 'react';
import type { CampaignLog, PlatformConnection, UserRow } from '@/lib/types';

const OAUTH_MESSAGES: Record<string, string> = {
  connected: 'Account connected.',
  not_configured: "This platform isn't configured yet — try again once it's set up.",
  state_mismatch: 'Connection attempt expired or was tampered with. Please try again.',
  missing_code: 'The platform did not return an authorization code. Please try again.',
  exchange_failed: 'Could not complete the connection. Please try again.',
  store_failed: 'Connected, but saving the connection failed. Please try again.',
  unauthenticated: 'Please sign in before connecting an account.',
};

const PLANS = [
  // Credits meter the work this app does on its own hardware, not an ad
  // budget -- so the unit is renders, not impressions bought.
  { id: 'starter', label: 'Starter', price: '€49/mo', credits: '50 renders' },
  { id: 'pro', label: 'Pro', price: '€149/mo', credits: '250 renders' },
  { id: 'agency', label: 'Agency', price: '€499/mo', credits: '1,000 renders' },
] as const;

const CONNECTABLE_ACCOUNTS = [
  { platform: 'tiktok', label: 'TikTok' },
  { platform: 'google', label: 'YouTube' },
] as const;

/** Fallbacks for error codes the API can return without a `detail`. */
const CAMPAIGN_ERRORS: Record<string, string> = {
  not_connected: "You haven't connected that account yet.",
  not_configured: "This platform isn't set up on this deployment yet.",
  not_reviewed: "This app is still awaiting the platform's publishing approval.",
  not_implemented: "Publishing to this platform isn't available yet.",
  upstream_error: 'The platform rejected the upload.',
  unsupported_url: 'Only TikTok and YouTube links are accepted.',
  unauthenticated: 'Please sign in again.',
};

// One render, one credit. (Under the ad model this defaulted to 1000,
// because a credit was a unit of ad spend rather than a unit of work.)
const DEFAULT_CREDIT_REQUEST = 1;

/**
 * A failed request can return an HTML error page rather than JSON. Letting
 * `res.json()` throw there turns a reportable server error into an unhandled
 * rejection, so the caller can't tell the user anything useful.
 */
async function readJson(res: Response): Promise<Record<string, any>> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { detail: `Unexpected response from the server (${res.status}).` };
  }
}

export default function Dashboard({
  user,
  campaigns: initialCampaigns,
  connections,
}: {
  user: UserRow;
  campaigns: CampaignLog[];
  connections: PlatformConnection[];
}) {
  const [url, setUrl] = useState('');
  const [credits, setCredits] = useState(DEFAULT_CREDIT_REQUEST);
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [activeCredits, setActiveCredits] = useState(user.active_credits);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const oauthStatus = params.get('oauth');
    if (oauthStatus) {
      setMessage(OAUTH_MESSAGES[oauthStatus] ?? null);
      params.delete('oauth');
      params.delete('platform');
      const query = params.toString();
      window.history.replaceState({}, '', query ? `/?${query}` : '/');
    }
    // Only on mount: this reads the URL the page loaded with, not a
    // navigable route param — nothing here should re-run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const body = await readJson(res);

      if (res.ok) {
        setCampaigns((prev) => [body.campaign, ...prev]);
        setActiveCredits((prev) => prev - credits);
        setUrl('');
        // A 201 can still carry a warning: the video is live but its
        // status row didn't get written. Saying "published" and hiding that
        // invites a resubmit that double-posts to the creator's account.
        setMessage(
          body.warning
            ? `Published, but: ${body.detail ?? body.warning}`
            : 'Published.'
        );
        return;
      }

      if (res.status === 402) {
        setMessage('Not enough credits for this request. Upgrade your plan below.');
        return;
      }

      // The route returns a machine-readable `error` plus human `detail`
      // and `remedy`. Showing the bare code ("not_implemented") tells the
      // creator nothing about what to do next.
      setMessage(
        [body.detail ?? CAMPAIGN_ERRORS[body.error] ?? 'Something went wrong.', body.remedy]
          .filter(Boolean)
          .join(' ') +
          (body.refunded ? ' Your credits were refunded.' : '')
      );
    } catch (err) {
      // Without this the request could fail and leave the form looking
      // idle, as if the click never registered.
      setMessage(`Could not reach the server: ${(err as Error).message}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpgrade(plan: (typeof PLANS)[number]['id']) {
    setMessage(null);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const body = await readJson(res);

      if (res.ok && body.url) {
        window.location.href = body.url;
        return;
      }

      // Previously this branch did nothing at all: a failed checkout left
      // the button looking inert with no explanation.
      setMessage(
        body.detail ??
          body.error ??
          `Could not start checkout (${res.status}). Please try again.`
      );
    } catch (err) {
      setMessage(`Could not reach the server: ${(err as Error).message}`);
    }
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
            {submitting ? 'Publishing…' : 'Publish'}
          </button>
        </form>
        {message && <p className="mt-2 text-sm text-neutral-500">{message}</p>}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-neutral-500">
          Connected accounts
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {CONNECTABLE_ACCOUNTS.map((account) => {
            const connected = connections.some((c) => c.platform === account.platform);
            return (
              <div
                key={account.platform}
                className="flex items-center justify-between rounded-md border border-neutral-200 px-4 py-3 dark:border-neutral-800"
              >
                <span className="text-sm font-medium">{account.label}</span>
                {connected ? (
                  <span className="text-sm text-green-600 dark:text-green-500">Connected ✓</span>
                ) : (
                  <a
                    href={`/api/oauth/${account.platform}/start`}
                    className="rounded-md border border-brand-600 px-3 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50 dark:hover:bg-neutral-900"
                  >
                    Connect
                  </a>
                )}
              </div>
            );
          })}
        </div>
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
