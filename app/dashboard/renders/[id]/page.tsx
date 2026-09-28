'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { PlatformServiceNotice } from '@/components/PlatformServiceNotice';
import { platformApiFetch } from '@/lib/platform-api';
import { CheckCircle2, Clock, Download, Share2, AlertCircle, Sparkles, Copy, TrendingUp } from 'lucide-react';

interface RenderJobStatus {
  video_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  quality_tier: string;
  output_url?: string;
  render_time_seconds?: number;
  progress_stage?: string;
  viral_score?: number;
  seo_metadata?: {
    tiktok?: { title: string; caption: string; hashtags: string[] };
    youtube_shorts?: { title: string; description: string; hashtags: string[] };
  };
}

export default function RenderStatusPage() {
  const params = useParams();
  const router = useRouter();
  const videoId = params.id as string;

  const [job, setJob] = useState<RenderJobStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [serviceUnavailable, setServiceUnavailable] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState<boolean>(false);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [reachError, setReachError] = useState(false);

  const fetchStatus = useCallback(async () => {
    const result = await platformApiFetch<RenderJobStatus>(`/api/v1/videos/${videoId}/status`);

    if (result.state === 'unavailable') {
      setServiceUnavailable(true);
      return true;
    }
    if (result.state === 'not_found') {
      // The service answered and has no such render. Reporting this as a
      // backend outage sent people to check a service that was working
      // fine, when the real answer is that this id is wrong or expired.
      setNotFound(true);
      setError(`No render job with id "${videoId}". It may have expired or been deleted.`);
      return true;
    }
    if (result.state === 'unreachable') {
      setReachError(true);
      setError(`Could not reach the render service: ${result.message}`);
      return true;
    }
    if (result.state === 'error') {
      setError(result.message);
      return true;
    }

    setJob(result.data);
    return result.data.status === 'completed' || result.data.status === 'failed';
  }, [videoId]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;

    const runPoll = async () => {
      const stop = await fetchStatus();
      if (!stop) {
        interval = setInterval(async () => {
          const shouldStop = await fetchStatus();
          if (shouldStop) clearInterval(interval);
        }, 3000);
      }
    };

    runPoll();
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleDirectPublish = async (platform: 'tiktok' | 'instagram' | 'youtube') => {
    setIsPublishing(true);
    setPublishSuccess(null);
    setPublishError(null);

    // Goes through platformApiFetch so a publish attempt against an absent
    // backend reports that, rather than "Failed publishing to tiktok" —
    // which read as a platform rejection and sent people to check their
    // TikTok account.
    const result = await platformApiFetch<{ status?: string }>('/api/v1/social/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_id: videoId, platform }),
    });

    // Publishing failures are reported inline, next to the button that
    // caused them. Routing them to `error` blanked the whole page, taking
    // the finished render and its download link with it.
    switch (result.state) {
      case 'ok':
        setPublishSuccess(`Successfully dispatched to ${platform.toUpperCase()}!`);
        break;
      case 'unavailable':
        setPublishError('The publishing service is not deployed here, so nothing was sent.');
        break;
      case 'unreachable':
        setPublishError(`Could not reach the publishing service: ${result.message}`);
        break;
      case 'not_found':
        setPublishError('The publishing endpoint does not exist on this backend version.');
        break;
      case 'error':
        // The server's own explanation ("TikTok account not connected",
        // "Video is not ready for publishing") is far more useful than a
        // generic failure line.
        setPublishError(result.message);
        break;
    }

    setIsPublishing(false);
  };

  if (serviceUnavailable) {
    return (
      <div className="max-w-xl mx-auto my-20 px-4">
        <PlatformServiceNotice feature="Render progress" />
      </div>
    );
  }

  if (error) {
    // "Pipeline Execution Error" for every failure implied the render itself
    // blew up, which sent people looking at a video pipeline that had never
    // run. The heading now matches what actually went wrong.
    const heading = notFound
      ? 'Render not found'
      : reachError
        ? 'Cannot reach the render service'
        : 'Pipeline Execution Error';

    return (
      <div className="max-w-xl mx-auto my-20 p-6 bg-neutral-950 border border-red-900 rounded-xl text-center">
        <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
        <h2 className="text-lg font-bold text-white">{heading}</h2>
        <p className="text-xs text-neutral-400 mt-2">{error}</p>
        <Button onClick={() => router.push('/')} className="mt-4 text-xs bg-neutral-800">
          Return to Dashboard
        </Button>
      </div>
    );
  }

  const isRendering = job?.status === 'queued' || job?.status === 'processing';

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:p-8 text-neutral-100 min-h-screen">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-8">
        <div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-amber-500">
            Render Node Task #{videoId?.slice(0, 8)}
          </span>
          <h1 className="text-2xl font-black mt-1">Video Output</h1>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs">
          <span className="text-neutral-500">Tier:</span>
          <span className="px-2.5 py-1 bg-neutral-900 border border-neutral-800 rounded-md font-bold uppercase text-amber-400">
            {job?.quality_tier || 'standard'}
          </span>
        </div>
      </div>

      {isRendering && (
        <div className="p-8 bg-neutral-950 border border-neutral-800 rounded-2xl flex flex-col items-center justify-center text-center my-12">
          <div className="relative w-16 h-16 mb-4">
            <div className="absolute inset-0 rounded-full border-4 border-neutral-800 animate-pulse" />
            <div className="absolute inset-0 rounded-full border-4 border-amber-500 border-t-transparent animate-spin" />
          </div>
          <h3 className="text-base font-bold text-neutral-100">Transcoding &amp; Aligning Stems</h3>
          <p className="text-xs text-neutral-400 max-w-md mt-1 font-mono">
            {job?.progress_stage || 'Rendering...'}
          </p>
          <div className="flex items-center gap-4 mt-6 text-xs text-neutral-500 font-mono">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> SLA target: &lt;120s
            </span>
          </div>
        </div>
      )}

      {job?.status === 'completed' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="w-full max-w-[340px] aspect-[9/16] bg-black rounded-2xl overflow-hidden border border-neutral-800 shadow-2xl relative">
              <video src={job.output_url} controls autoPlay loop playsInline className="w-full h-full object-cover" />
            </div>
            <div className="flex items-center gap-3 mt-4 w-full max-w-[340px]">
              <a href={job.output_url} download className="flex-1">
                <Button className="w-full bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 text-xs font-semibold py-2">
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Download MP4
                </Button>
              </a>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-6">
            <div className="p-4 bg-neutral-900/70 border border-neutral-800 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-950/60 border border-emerald-800/80 rounded-lg text-emerald-400">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-neutral-200">Algorithmic Virality Score</h4>
                  <p className="text-[11px] text-neutral-400">Pacing, hook retention, and audio ducking confirmed</p>
                </div>
              </div>
              <span className="text-2xl font-black text-emerald-400 font-mono">{job.viral_score ?? '--'}%</span>
            </div>

            <div className="p-5 bg-neutral-950 border border-neutral-800 rounded-xl space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                <Share2 className="w-3.5 h-3.5 text-amber-500" /> Direct Social Publishing
              </h3>
              {publishError && (
                <div className="p-2 bg-rose-950/60 border border-rose-800 rounded text-xs text-rose-300 font-mono">{publishError}</div>
              )}

              {publishSuccess && (
                <div className="p-2 bg-emerald-950/60 border border-emerald-800 rounded text-xs text-emerald-300 font-mono">{publishSuccess}</div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <Button disabled={isPublishing} onClick={() => handleDirectPublish('tiktok')} className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs text-neutral-200">
                  TikTok
                </Button>
                <Button disabled={isPublishing} onClick={() => handleDirectPublish('instagram')} className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs text-neutral-200">
                  Reels
                </Button>
                <Button disabled={isPublishing} onClick={() => handleDirectPublish('youtube')} className="bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs text-neutral-200">
                  Shorts
                </Button>
              </div>
            </div>

            <div className="p-5 bg-neutral-950 border border-neutral-800 rounded-xl space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" /> Optimized Distribution Copy
              </h3>

              <div className="p-3 bg-neutral-900/60 border border-neutral-800/80 rounded-lg space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium text-neutral-400">
                  <span>TikTok Caption &amp; Tags</span>
                  <button
                    onClick={() =>
                      handleCopy(
                        `${job.seo_metadata?.tiktok?.caption || ''} ${(job.seo_metadata?.tiktok?.hashtags || []).join(' ')}`,
                        'tiktok'
                      )
                    }
                    className="text-neutral-400 hover:text-white flex items-center gap-1 text-[11px]"
                  >
                    {copiedKey === 'tiktok' ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    {copiedKey === 'tiktok' ? 'Copied' : 'Copy Deck'}
                  </button>
                </div>
                <p className="text-xs font-mono text-neutral-200">{job.seo_metadata?.tiktok?.caption || 'No caption generated yet.'}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
