'use client';

import { useState } from 'react';
import { Loader2, Compass, Sparkles, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorNotice } from '@/components/ErrorNotice';
import type { AuditReportRow, SiteDiscoveryResult } from '@/lib/types';

type DiscoveryReport = AuditReportRow<SiteDiscoveryResult>;

export function SiteDiscoveryForm() {
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<DiscoveryReport | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const res = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim() }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
      setReport(body.report as DiscoveryReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Web discovery failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-3">
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="What do you need from the internet? e.g. 'AI video editing tools for solo creators'"
          rows={2}
          maxLength={300}
          className="w-full px-3 py-3 rounded-lg bg-neutral-900 border border-neutral-800 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-amber-600 resize-none"
        />
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={loading || !query.trim()}
            className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold h-11"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Compass className="w-4 h-4 mr-1.5" /> Scan the web
              </>
            )}
          </Button>
        </div>
      </form>

      {error && <ErrorNotice message={error} />}

      {report && <DiscoveryCard report={report} />}
    </div>
  );
}

export function DiscoveryCard({ report }: { report: DiscoveryReport }) {
  const a = report.analysis;

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 space-y-6">
      <div>
        <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
          Results for &quot;{a.query}&quot;
        </span>
        <p className="text-sm text-neutral-300 mt-2">{a.summary}</p>
      </div>

      <div className="space-y-2">
        <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
          Top {a.sites.length}
        </span>
        <ul className="space-y-2">
          {a.sites.map((site, i) => {
            const isOutlier = site.url === a.outlier.url;
            return (
              <li
                key={site.url}
                className={`p-3 rounded-lg border text-xs space-y-1 ${
                  isOutlier
                    ? 'border-amber-600 bg-amber-950/20'
                    : 'border-neutral-800 bg-neutral-900/60'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-amber-500">{i + 1}.</span>
                    <a
                      href={site.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="font-semibold text-neutral-100 hover:text-amber-400 truncate flex items-center gap-1"
                    >
                      {site.title} <ExternalLink className="w-3 h-3 shrink-0" />
                    </a>
                  </span>
                  {isOutlier && (
                    <span className="shrink-0 flex items-center gap-1 text-[10px] font-mono uppercase text-amber-400">
                      <Sparkles className="w-3 h-3" /> Outlier
                    </span>
                  )}
                </div>
                <p className="text-neutral-500 font-mono">{site.domain}</p>
                <p className="text-neutral-400">{site.snippet}</p>
                <p className="text-neutral-500 italic">{site.relevance_reason}</p>
                {isOutlier && (
                  <p className="text-amber-300 pt-1 border-t border-amber-900/50 mt-1">
                    Why it&apos;s different: {a.outlier.reasoning}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
