'use client';

import { useState } from 'react';
import { Loader2, Plus, Trash2, Swords } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorNotice } from '@/components/ErrorNotice';
import type { AccountPlatform, AuditReportRow, CompetitorGapAnalysis, CompetitorHandle } from '@/lib/types';

const PLATFORMS: { value: AccountPlatform; label: string }[] = [
  { value: 'youtube', label: 'YouTube' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'instagram', label: 'Instagram' },
];

type CompetitorReport = AuditReportRow<CompetitorGapAnalysis>;

export function CompetitorTrackerForm() {
  const [niche, setNiche] = useState('');
  const [handles, setHandles] = useState<CompetitorHandle[]>([
    { platform: 'youtube', handle: '' },
    { platform: 'youtube', handle: '' },
    { platform: 'youtube', handle: '' },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<CompetitorReport | null>(null);

  function updateHandle(i: number, patch: Partial<CompetitorHandle>) {
    setHandles((prev) => prev.map((h, idx) => (idx === i ? { ...h, ...patch } : h)));
  }

  function addHandle() {
    if (handles.length >= 5) return;
    setHandles((prev) => [...prev, { platform: 'youtube', handle: '' }]);
  }

  function removeHandle(i: number) {
    if (handles.length <= 3) return;
    setHandles((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setReport(null);

    const filled = handles.filter((h) => h.handle.trim().length > 0);

    try {
      const res = await fetch('/api/competitors/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handles: filled, niche: niche || undefined }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
      setReport(body.report as CompetitorReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Competitor analysis failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          value={niche}
          onChange={(e) => setNiche(e.target.value)}
          placeholder="Your niche (optional, e.g. budget home cooking)"
          className="w-full h-11 px-3 rounded-lg bg-neutral-900 border border-neutral-800 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-amber-600"
        />

        <div className="space-y-2">
          {handles.map((h, i) => (
            <div key={i} className="flex gap-2">
              <select
                value={h.platform}
                onChange={(e) => updateHandle(i, { platform: e.target.value as AccountPlatform })}
                className="h-11 px-3 rounded-lg bg-neutral-900 border border-neutral-800 text-sm text-neutral-100 focus:outline-none focus:border-amber-600"
              >
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={h.handle}
                onChange={(e) => updateHandle(i, { handle: e.target.value })}
                placeholder="Competitor handle (@name)"
                className="flex-1 h-11 px-3 rounded-lg bg-neutral-900 border border-neutral-800 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-amber-600"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeHandle(i)}
                disabled={handles.length <= 3}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <Button type="button" variant="outline" size="sm" onClick={addHandle} disabled={handles.length >= 5}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add competitor
          </Button>
          <Button
            type="submit"
            disabled={loading}
            className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold h-11"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Swords className="w-4 h-4 mr-1.5" /> Run espionage
              </>
            )}
          </Button>
        </div>
      </form>

      {error && <ErrorNotice message={error} />}

      {report && <GapAnalysisCard report={report} />}
    </div>
  );
}

export function GapAnalysisCard({ report }: { report: AuditReportRow<CompetitorGapAnalysis> }) {
  const a = report.analysis;

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 space-y-6">
      <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
        Competitor gap analysis
      </span>

      <div className="space-y-2">
        <span className="text-[10px] font-mono uppercase text-neutral-500">Tracked competitors</span>
        <ul className="space-y-2">
          {a.competitors.map((c, i) => (
            <li key={i} className="p-3 rounded-lg bg-neutral-900/60 border border-neutral-800 text-xs">
              <span className="font-mono text-amber-400 uppercase">{c.platform}</span>{' '}
              <span className="text-neutral-300">{c.handle}</span>
              {c.fetch_error ? (
                <p className="text-rose-400 mt-1">Could not fetch: {c.fetch_error}</p>
              ) : (
                <p className="text-neutral-400 mt-1">{c.summary}</p>
              )}
            </li>
          ))}
        </ul>
      </div>

      <GapList title="Outlier topics they're winning with" items={a.outlier_topics} />
      <GapList title="Topics missing from your own work" items={a.missing_topics} />
      <GapList title="Audience sentiment gaps" items={a.audience_sentiment_gaps} />
      <GapList title="Untapped keyword clusters" items={a.untapped_keyword_clusters} />
    </div>
  );
}

function GapList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">{title}</span>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-xs text-neutral-300 flex gap-2">
            <span className="text-amber-500 font-mono">{i + 1}.</span> {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
