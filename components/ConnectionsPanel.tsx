'use client';

import { useEffect, useState } from 'react';
import { Loader2, Link2, Unlink, TriangleAlert, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ConnectablePlatform, PlatformConnectionSummary } from '@/lib/types';

const PLATFORM_INFO: Record<ConnectablePlatform, { label: string; description: string; caveat: string }> = {
  youtube: {
    label: 'YouTube',
    description: 'Direct upload via the YouTube Data API (videos.insert). Publishes as a Short.',
    caveat: 'No review gate -- works immediately once YOUTUBE_OAUTH_CLIENT_ID/SECRET are set.',
  },
  tiktok: {
    label: 'TikTok',
    description: 'Direct Post via the TikTok Content Posting API.',
    caveat: 'Unaudited apps can only post as private/self-only until TikTok completes a content audit (5-10 business days).',
  },
  facebook: {
    label: 'Facebook',
    description: 'Reels Publishing API, posted to a Page you manage.',
    caveat: 'Requires Meta App Review for pages_manage_posts before this works for accounts other than your own developer role.',
  },
  canva: {
    label: 'Canva',
    description: 'Connect API -- lets the Tool Suite Hub create a design directly instead of a deep link.',
    caveat: 'Private integrations work immediately for testing; going live for arbitrary users needs Canva’s integration review.',
  },
};

const ALL_PLATFORMS: ConnectablePlatform[] = ['youtube', 'tiktok', 'facebook', 'canva'];

export function ConnectionsPanel() {
  const [connections, setConnections] = useState<PlatformConnectionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyPlatform, setBusyPlatform] = useState<ConnectablePlatform | null>(null);

  async function fetchConnections() {
    try {
      const res = await fetch('/api/connections');
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
      setConnections(body.connections as PlatformConnectionSummary[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load connections.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchConnections();
  }, []);

  async function handleDisconnect(platform: ConnectablePlatform) {
    setBusyPlatform(platform);
    try {
      const res = await fetch(`/api/connections?platform=${platform}`, { method: 'DELETE' });
      if (res.ok) setConnections((prev) => prev.filter((c) => c.platform !== platform));
    } finally {
      setBusyPlatform(null);
    }
  }

  if (loading) {
    return (
      <div className="py-16 flex justify-center text-neutral-500">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="flex items-start gap-2 p-4 rounded-xl border border-rose-900 bg-rose-950/40 text-rose-200 text-xs">
          <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {ALL_PLATFORMS.map((platform) => {
        const info = PLATFORM_INFO[platform];
        const connection = connections.find((c) => c.platform === platform);
        return (
          <div
            key={platform}
            className="p-4 rounded-xl bg-neutral-950 border border-neutral-800 flex items-start justify-between gap-4"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-neutral-100">{info.label}</span>
                {connection && (
                  <span className="flex items-center gap-1 text-[10px] font-mono uppercase text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" /> connected
                  </span>
                )}
              </div>
              <p className="text-xs text-neutral-400 mt-1">{info.description}</p>
              {connection?.external_account_label && (
                <p className="text-xs text-neutral-500 mt-1">as {connection.external_account_label}</p>
              )}
              <p className="text-[10px] text-neutral-600 mt-2">{info.caveat}</p>
            </div>

            {connection ? (
              <Button
                variant="ghost"
                size="sm"
                disabled={busyPlatform === platform}
                onClick={() => handleDisconnect(platform)}
                className="shrink-0"
              >
                {busyPlatform === platform ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Unlink className="w-3.5 h-3.5 mr-1.5" /> Disconnect
                  </>
                )}
              </Button>
            ) : (
              <a href={`/api/oauth/${platform}/start`} className="shrink-0">
                <Button size="sm" className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold">
                  <Link2 className="w-3.5 h-3.5 mr-1.5" /> Connect
                </Button>
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
