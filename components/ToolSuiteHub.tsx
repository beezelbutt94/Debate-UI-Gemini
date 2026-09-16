'use client';

import { useEffect, useState } from 'react';
import { ExternalLink, Loader2, RefreshCw, TriangleAlert, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ToolRecommendation } from '@/lib/types';

interface RecommendationsResponse {
  recommendations: ToolRecommendation[];
  personalized: boolean;
}

export function ToolSuiteHub() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<RecommendationsResponse | null>(null);

  // No synchronous setState before the first `await` here -- calling this
  // directly from the mount effect below doesn't trigger a synchronous
  // render during the effect's own execution (the state it does update is
  // set from a promise callback, not the effect body itself).
  async function fetchRecommendations() {
    try {
      const res = await fetch('/api/tools/recommendations');
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
      setData(body as RecommendationsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load recommendations.');
    } finally {
      setLoading(false);
    }
  }

  function handleRefresh() {
    setLoading(true);
    setError(null);
    fetchRecommendations();
  }

  useEffect(() => {
    // This rule flags any effect that transitively reaches a setState
    // call, even one deferred until after an await -- which is what a
    // plain fetch-on-mount effect always does. The same pattern (and the
    // same lint finding) already exists, unfixed, in the pre-existing
    // app/dashboard/settings/domain/page.tsx; migrating either to a
    // Suspense/loader-based data-fetching setup is a real architectural
    // change out of scope for one component.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchRecommendations();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-neutral-500">
          {data?.personalized
            ? 'Grounded in your recent reports and scripts.'
            : 'Generic starting points — run an analysis first for personalized recommendations.'}
        </span>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={loading}>
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Refresh
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-4 rounded-xl border border-rose-900 bg-rose-950/40 text-rose-200 text-xs">
          <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading && !data && (
        <div className="py-16 flex justify-center text-neutral-500">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      )}

      {data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.recommendations.map((rec, i) => (
            <div key={i} className="p-5 rounded-2xl bg-neutral-950 border border-neutral-800 space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm font-bold text-white">
                  <Wand2 className="w-4 h-4 text-amber-400" />
                  {rec.label}
                </span>
                <a
                  href={rec.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1"
                >
                  Open <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <p className="text-xs text-neutral-300">{rec.reason}</p>
              <p className="text-xs text-neutral-400">
                <span className="text-neutral-500">Do this: </span>
                {rec.action}
              </p>
              <p className="text-[10px] font-mono text-neutral-600 border-t border-neutral-900 pt-2">
                Based on: {rec.source}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
