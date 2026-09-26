'use client';

import { useRef, useState } from 'react';
import { Loader2, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorNotice } from '@/components/ErrorNotice';
import type { AuditReportRow, UploadDiagnosis } from '@/lib/types';
import { uploadVideo } from '@/lib/upload-client';

type DiagnosticReport = AuditReportRow<UploadDiagnosis>;

export function UploadDiagnosticForm() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<'idle' | 'uploading' | 'diagnosing'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<DiagnosticReport | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setReport(null);
    setProgress(0);

    try {
      setStage('uploading');
      const uploaded = await uploadVideo(file, setProgress);

      setStage('diagnosing');
      const diagnoseRes = await fetch('/api/analyze/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicId: uploaded.public_id }),
      });
      const diagnoseBody = await diagnoseRes.json();
      if (!diagnoseRes.ok) throw new Error(diagnoseBody.error ?? `Request failed (${diagnoseRes.status})`);

      setReport(diagnoseBody.report as DiagnosticReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload diagnostic failed.');
    } finally {
      setStage('idle');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  const loading = stage !== 'idle';

  return (
    <div className="space-y-6">
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/quicktime"
          onChange={handleFileChange}
          disabled={loading}
          className="hidden"
          id="video-upload-input"
        />
        <label
          htmlFor="video-upload-input"
          className={`flex flex-col items-center justify-center gap-2 h-40 rounded-xl border-2 border-dashed border-neutral-800 text-neutral-500 cursor-pointer hover:border-amber-600 hover:text-amber-400 transition-colors ${loading ? 'pointer-events-none opacity-60' : ''}`}
        >
          {loading ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              <span className="text-xs font-mono">
                {stage === 'uploading' ? `Uploading… ${progress}%` : 'Analyzing frames + audio…'}
              </span>
            </>
          ) : (
            <>
              <UploadCloud className="w-6 h-6" />
              <span className="text-xs font-mono">Click to upload an MP4 or MOV</span>
            </>
          )}
        </label>
      </div>

      {error && <ErrorNotice message={error} />}

      {report && <DiagnosisCard report={report} />}
    </div>
  );
}

export function DiagnosisCard({ report }: { report: DiagnosticReport }) {
  const d = report.analysis;

  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">
          Upload diagnostic · {d.frames_analyzed} frames analyzed
        </span>
        <div className="text-right">
          <span className="text-3xl font-black text-amber-400">{Math.round(report.viral_score ?? 0)}</span>
          <span className="text-xs text-neutral-500">/100 viral score</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1">
          <span className="text-[10px] font-mono uppercase text-neutral-500">Visual hook clarity</span>
          <p className="text-sm font-bold capitalize">
            {d.visual_hook_clarity.verdict} ({Math.round(d.visual_hook_clarity.score)}/100)
          </p>
          <p className="text-xs text-neutral-400">{d.visual_hook_clarity.notes}</p>
        </div>
        <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1">
          <span className="text-[10px] font-mono uppercase text-neutral-500">Audio balance</span>
          <p className="text-sm font-bold">{Math.round(d.audio_balance.score)}/100</p>
          <p className="text-xs text-neutral-400">{d.audio_balance.notes}</p>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-neutral-900/60 border border-neutral-800 space-y-1">
        <span className="text-[10px] font-mono uppercase text-neutral-500">Text-overlay pacing</span>
        <p className="text-xs text-neutral-400">{d.text_overlay_pacing.assessment}</p>
      </div>

      <ListSection title="B-roll recommendations" items={d.b_roll_recommendations} />
      <ListSection title="Retention boosters" items={d.retention_boosters} />

      {report.timeline_recommendations.length > 0 && (
        <div className="space-y-2">
          <span className="text-[10px] font-mono uppercase text-neutral-500">Timeline-pinned feedback</span>
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

function ListSection({ title, items }: { title: string; items: string[] }) {
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
