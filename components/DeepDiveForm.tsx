'use client';

import { useState } from 'react';
import { Loader2, TriangleAlert, UserSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AuditReportRow, GrowthBlueprint } from '@/lib/types';

type DeepDiveReport = AuditReportRow<GrowthBlueprint>;

export function DeepDiveForm() {
  const [niche, setNiche] = useState('');
  const [youtube, setYoutube] = useState('');
  const [tiktok, setTiktok] = useState('');
  const [instagram, setInstagram] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<DeepDiveReport | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const res = await fetch('/api/creators/deep-dive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche: niche || undefined,
          handles: {
            youtube: youtube || undefined,
            tiktok: tiktok || undefined,
            instagram: instagram || undefined,
          },
        }),
      });
      const responseBody = await res.json();

      if (!res.ok) {
        throw new Error(responseBody.error ?? `Request failed (${res.status})`);
      }

      setReport(responseBody.report as DeepDiveReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deep-dive failed.');
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
          placeholder="Your niche (e.g. budget home cooking)"
          className="w-full h-11 px-3 rounded-lg bg-neutral-900 border border-neutral-800 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-amber-600"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input
            type="text"
            value={youtube}
            onChange={(e) => setYoutube(e.target.value)}
            placeholder="YouTube handle (@name)"
            className="h-11 px-3 rounded-lg bg-neutral-900 border border-neutral-800 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-amber-600"
          />
          <input
            type="text"
            value={tiktok}
            onChange={(e) => setTiktok(e.target.value)}
            placeholder="TikTok handle (@name)"
            className="h-11 px-3 rounded-lg bg-neutral-900 border border-neutral-800 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-amber-600"
          />
          <input
            type="text"
            value={instagram}
            onChange={(e) => setInstagram(e.target.value)}
            placeholder="Instagram handle (@name)"
            className="h-11 px-3 rounded-lg bg-neutral-900 border border-neutral-800 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-amber-600"
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold h-11 w-full md:w-auto"
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <UserSearch className="w-4 h-4 mr-1.5" /> Run deep-dive
            </>
          )}
        </Button>
      </form>

      {error && (
        <div className="flex items-start gap-2 p-4 rounded-xl border border-rose-900 bg-rose-950/40 text-rose-200 text-xs">
          <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {report && <BlueprintCard report={report} />}
    </div>
  );
}

function BlueprintCard({ report }: { report: DeepDiveReport }) {
  const blueprint = report.analysis;

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
          Growth blueprint
        </span>
        <div className="text-right">
          <span className="text-3xl font-black text-amber-400">{Math.round(report.viral_score ?? 0)}</span>
          <span className="text-xs text-neutral-500">/100 account health</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1">
          <span className="text-[10px] font-mono uppercase text-neutral-500">Thematic consistency</span>
          <p className="text-sm font-bold">{Math.round(blueprint.thematic_consistency.score)}/100</p>
          <p className="text-xs text-neutral-400">{blueprint.thematic_consistency.notes}</p>
        </div>
        <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1">
          <span className="text-[10px] font-mono uppercase text-neutral-500">View-to-follower ratio</span>
          <p className="text-sm font-bold">
            {blueprint.view_to_follower_ratio.value !== null
              ? `${(blueprint.view_to_follower_ratio.value * 100).toFixed(1)}%`
              : 'n/a'}
          </p>
          <p className="text-xs text-neutral-400">{blueprint.view_to_follower_ratio.assessment}</p>
        </div>
        <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1">
          <span className="text-[10px] font-mono uppercase text-neutral-500">Posting cadence</span>
          <p className="text-sm font-bold">
            {blueprint.posting_cadence.avg_days_between_posts !== null
              ? `every ${blueprint.posting_cadence.avg_days_between_posts.toFixed(1)}d`
              : 'n/a'}
          </p>
          <p className="text-xs text-neutral-400">{blueprint.posting_cadence.assessment}</p>
        </div>
      </div>

      <BlueprintList title="Theme correction" items={blueprint.theme_correction} />
      <BlueprintList title="View maximization tactics" items={blueprint.view_maximization_tactics} />
      <BlueprintList title="Posting blindspots" items={blueprint.posting_blindspots} />

      {Object.keys(blueprint.per_platform_notes).length > 0 && (
        <div className="space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
            Per-platform notes
          </span>
          <ul className="space-y-2">
            {Object.entries(blueprint.per_platform_notes).map(([platform, note]) => (
              <li key={platform} className="text-xs p-3 rounded-lg bg-neutral-900/60 border border-neutral-800">
                <span className="font-mono text-amber-400 uppercase">{platform}</span>
                <p className="text-neutral-400 mt-1">{note}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function BlueprintList({ title, items }: { title: string; items: string[] }) {
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
