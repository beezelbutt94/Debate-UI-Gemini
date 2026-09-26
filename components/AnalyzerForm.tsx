'use client';

import { useState } from 'react';
import { Loader2, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorNotice } from '@/components/ErrorNotice';
import type { AuditReportRow, ViralGapAnalysis } from '@/lib/types';

type AnalyzerReport = AuditReportRow<ViralGapAnalysis>;

export function AnalyzerForm({ onAnalyzed }: { onAnalyzed?: (report: AnalyzerReport) => void }) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<AnalyzerReport | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setReport(null);

    try {
      const res = await fetch('/api/analyze/url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const body = await res.json();

      if (!res.ok) {
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }

      setReport(body.report as AnalyzerReport);
      onAnalyzed?.(body.report as AnalyzerReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="url"
            required
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a TikTok, YouTube Shorts, or Facebook Reel URL"
            className="w-full h-11 pl-9 pr-3 rounded-lg bg-neutral-900 border border-neutral-800 text-sm text-neutral-100 placeholder:text-neutral-600 focus:outline-none focus:border-amber-600"
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold h-11"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Analyze'}
        </Button>
      </form>

      {error && <ErrorNotice message={error} />}

      {report && <AnalysisReportCard report={report} />}
    </div>
  );
}

export function AnalysisReportCard({ report }: { report: AnalyzerReport }) {
  const { analysis } = report;

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
          {report.platform?.replace('_', ' ')}
        </span>
        <div className="text-right">
          <span className="text-3xl font-black text-amber-400">{Math.round(report.viral_score ?? 0)}</span>
          <span className="text-xs text-neutral-500">/100 viral score</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1">
          <span className="text-[10px] font-mono uppercase text-neutral-500">3s Hook</span>
          <p className="text-sm font-bold capitalize">
            {analysis.hook_evaluation.verdict} ({Math.round(analysis.hook_evaluation.score)}/100)
          </p>
          <p className="text-xs text-neutral-400">{analysis.hook_evaluation.notes}</p>
        </div>

        <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1">
          <span className="text-[10px] font-mono uppercase text-neutral-500">Retention prediction</span>
          <p className="text-xs text-neutral-300">
            3s: {analysis.retention_prediction.at_3s_percent}%{' '}
            {analysis.retention_prediction.meets_3s_benchmark ? '✅' : '⚠️ below 60% benchmark'}
          </p>
          <p className="text-xs text-neutral-300">
            30s: {analysis.retention_prediction.at_30s_percent}%{' '}
            {analysis.retention_prediction.meets_30s_benchmark ? '✅' : '⚠️ below 40% benchmark'}
          </p>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1">
        <span className="text-[10px] font-mono uppercase text-neutral-500">Pacing audit</span>
        <p className="text-xs text-neutral-400">{analysis.pacing_audit.assessment}</p>
      </div>

      <div className="space-y-2">
        <span className="text-[10px] font-mono uppercase text-neutral-500">Action plan</span>
        <ul className="space-y-1.5">
          {analysis.action_plan.map((item, i) => (
            <li key={i} className="text-xs text-neutral-300 flex gap-2">
              <span className="text-amber-500 font-mono">{i + 1}.</span> {item}
            </li>
          ))}
        </ul>
      </div>

      {report.timeline_recommendations.length > 0 && (
        <div className="space-y-2">
          <span className="text-[10px] font-mono uppercase text-neutral-500">Timeline recommendations</span>
          <ul className="space-y-2">
            {report.timeline_recommendations.map((rec, i) => (
              <li
                key={i}
                className="text-xs p-3 rounded-lg bg-neutral-900/60 border border-neutral-800 flex gap-3"
              >
                <span className="font-mono text-amber-400 shrink-0">{rec.timestamp_seconds}s</span>
                <div>
                  <p className="text-neutral-200 font-semibold">{rec.issue}</p>
                  <p className="text-neutral-400">{rec.recommendation}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
