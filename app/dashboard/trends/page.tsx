'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Flame, TrendingUp, Music, Hash, Sparkles, Loader2 } from 'lucide-react';

interface TrendItem {
  id: string;
  platform: 'tiktok' | 'reels' | 'shorts';
  trend_type: 'sound' | 'hashtag' | 'format';
  external_identifier: string;
  title: string;
  velocity_score: number;
  current_post_count: number;
  is_rising: boolean;
  detected_at: string;
}

export default function TrendDetectionDashboard() {
  const [trends, setTrends] = useState<TrendItem[]>([]);
  const [filterType, setFilterType] = useState<string>('all');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadTrends() {
      setLoading(true);
      try {
        const query = filterType !== 'all' ? `?type=${filterType}` : '';
        const res = await fetch(`/api/v1/analytics/trends${query}`);
        if (res.ok) setTrends(await res.json());
      } catch (err) {
        console.error('Failed to load trends', err);
      } finally {
        setLoading(false);
      }
    }
    loadTrends();
  }, [filterType]);

  return (
    <div className="max-w-6xl mx-auto p-8 text-neutral-100 min-h-screen space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-neutral-800 pb-6">
        <div>
          <span className="text-[10px] font-mono text-amber-500 uppercase tracking-widest flex items-center gap-1">
            <Flame className="w-3.5 h-3.5" /> Predictive Algorithmic Intelligence
          </span>
          <h1 className="text-3xl font-black mt-1">Real-Time Trend &amp; Velocity Radar</h1>
          <p className="text-xs text-neutral-400 mt-1">
            Monitor breakout audio, rising hashtags, and viral format archetypes before they saturate.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {['all', 'sound', 'hashtag', 'format'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium uppercase font-mono transition-all ${
                filterType === type
                  ? 'bg-amber-500 text-neutral-950 font-bold'
                  : 'bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white'
              }`}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-24 flex flex-col items-center justify-center text-neutral-500 text-xs">
          <Loader2 className="w-6 h-6 animate-spin text-amber-500 mb-2" />
          Scanning social graphs for breakout velocities...
        </div>
      ) : trends.length === 0 ? (
        <div className="py-24 text-center text-xs text-neutral-500 font-mono">
          No trend data yet. Ingest a snapshot via `/api/v1/analytics/trends/ingest` to see it here.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {trends.map((trend) => (
            <div key={trend.id} className="bg-neutral-950 border border-neutral-800 hover:border-neutral-700 rounded-2xl p-5 flex flex-col justify-between space-y-4 transition-all">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-neutral-900 border border-neutral-800 text-[10px] font-mono text-neutral-400 uppercase flex items-center gap-1">
                    {trend.trend_type === 'sound' && <Music className="w-3 h-3 text-amber-400" />}
                    {trend.trend_type === 'hashtag' && <Hash className="w-3 h-3 text-blue-400" />}
                    {trend.platform}
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-400 flex items-center gap-1">
                    <TrendingUp className="w-3.5 h-3.5" /> {trend.velocity_score}x Velocity
                  </span>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-white line-clamp-1">{trend.title}</h3>
                  <span className="text-[11px] font-mono text-neutral-500">{trend.current_post_count.toLocaleString()} posts indexed</span>
                </div>
              </div>

              <div className="pt-3 border-t border-neutral-800/80 flex items-center justify-between">
                <span className="text-[10px] font-mono text-amber-400/90">
                  {trend.is_rising ? 'Breakout Phase (Early)' : 'Plateau Detected'}
                </span>
                <Link href={`/dashboard/generate?prompt=${encodeURIComponent(`Create a video using ${trend.title}`)}`}>
                  <Button size="sm" className="bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-bold h-8">
                    <Sparkles className="w-3 h-3 mr-1" /> Create Video
                  </Button>
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
