'use client';

import { useEffect, useState } from 'react';
import { Loader2, Sparkles, Trash2, TriangleAlert, CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ScheduledPostRow } from '@/lib/types';

export function ScheduleCalendar() {
  const [posts, setPosts] = useState<ScheduledPostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchPosts() {
    try {
      const res = await fetch('/api/schedule');
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
      setPosts(body.posts as ScheduledPostRow[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your calendar.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // See components/ToolSuiteHub.tsx for why this needs the same
    // documented eslint-disable: any effect that transitively reaches a
    // setState call trips this rule, sync or not.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPosts();
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch('/api/schedule/generate', { method: 'POST' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
      await fetchPosts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calendar generation failed.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleReschedule(id: string, newIso: string) {
    const res = await fetch(`/api/schedule/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ publishAt: newIso }),
    });
    if (res.ok) await fetchPosts();
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/schedule/${id}`, { method: 'DELETE' });
    if (res.ok) setPosts((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-neutral-500">
          {posts.length} slot{posts.length === 1 ? '' : 's'} on your calendar
        </span>
        <Button
          onClick={handleGenerate}
          disabled={generating}
          className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold"
        >
          {generating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-1.5" /> Generate this week
            </>
          )}
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-4 rounded-xl border border-rose-900 bg-rose-950/40 text-rose-200 text-xs">
          <TriangleAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="py-16 flex justify-center text-neutral-500">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      ) : posts.length === 0 ? (
        <div className="py-16 text-center text-xs text-neutral-500 font-mono flex flex-col items-center gap-2">
          <CalendarClock className="w-6 h-6" />
          No slots yet. Generate a week, or add one manually below.
        </div>
      ) : (
        <ul className="space-y-2">
          {posts.map((post) => (
            <li
              key={post.id}
              className="flex items-center gap-3 p-4 rounded-xl bg-neutral-950 border border-neutral-800"
            >
              <span className="text-[10px] font-mono uppercase text-amber-400 shrink-0 w-24">
                {post.platform.replace('_', ' ')}
              </span>
              <input
                type="datetime-local"
                defaultValue={toLocalInputValue(post.publish_at)}
                onChange={(e) => e.target.value && handleReschedule(post.id, new Date(e.target.value).toISOString())}
                className="bg-neutral-900 border border-neutral-800 rounded px-2 py-1 text-xs text-neutral-200"
              />
              <span className="flex-1 text-xs text-neutral-400 truncate">{post.caption ?? '(no caption)'}</span>
              <span className="text-[10px] font-mono uppercase text-neutral-600">{post.status}</span>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(post.id)}>
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
