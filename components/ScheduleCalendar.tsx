'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CalendarClock, Film, Loader2, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorNotice } from '@/components/ErrorNotice';
import { uploadVideo } from '@/lib/upload-client';
import type { Platform, ScheduledPostRow } from '@/lib/types';

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'tiktok', label: 'TikTok' },
  { value: 'youtube_shorts', label: 'YouTube Shorts' },
  { value: 'facebook_reels', label: 'Facebook Reels' },
];
const LABEL: Record<Platform, string> = { tiktok: 'TikTok', youtube_shorts: 'YouTube Shorts', facebook_reels: 'Facebook Reels' };
const MAX_CAPTION = 2200;

const STATUS_STYLE: Record<ScheduledPostRow['status'], string> = {
  draft: 'text-neutral-400 border-neutral-700',
  scheduled: 'text-amber-300 border-amber-800',
  publishing: 'text-sky-300 border-sky-800',
  published: 'text-emerald-300 border-emerald-800',
  failed: 'text-rose-300 border-rose-800',
};

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
  });
  let body: Record<string, unknown> = {};
  try {
    body = await res.json();
  } catch {
    // Non-JSON error page; use the generic message below.
  }
  if (!res.ok) throw new Error((body.error as string) ?? `Something went wrong (${res.status}). Please try again.`);
  return body as T;
}

function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function defaultPublishTime(): string {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  return toLocalInputValue(d.toISOString());
}

function sortPosts(posts: ScheduledPostRow[]): ScheduledPostRow[] {
  return [...posts].sort((a, b) => a.publish_at.localeCompare(b.publish_at));
}

/** Attach/replace/remove the post's video. */
function VideoField({
  mediaUrl,
  disabled,
  onChange,
}: {
  mediaUrl: string | null;
  disabled?: boolean;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setProgress(0);
    try {
      const uploaded = await uploadVideo(file, setProgress);
      onChange(uploaded.secure_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.');
    } finally {
      setProgress(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" accept="video/mp4,video/quicktime" className="sr-only" onChange={pick} tabIndex={-1} />
      <div className="flex flex-wrap items-center gap-2">
        {mediaUrl ? (
          <a
            href={mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-neutral-300 underline decoration-neutral-600 hover:text-white"
          >
            <Film className="w-3.5 h-3.5" aria-hidden /> Video attached
          </a>
        ) : (
          <span className="text-xs text-neutral-500">No video attached</span>
        )}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || progress !== null}
          onClick={() => inputRef.current?.click()}
        >
          {progress !== null ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden /> Uploading {progress}%
            </>
          ) : mediaUrl ? (
            'Replace video'
          ) : (
            'Attach video'
          )}
        </Button>
        {mediaUrl && (
          <Button type="button" size="sm" variant="ghost" disabled={disabled || progress !== null} onClick={() => onChange(null)}>
            Remove
          </Button>
        )}
      </div>
      {error && <ErrorNotice message={error} />}
    </div>
  );
}

function NewPostForm({ onCreated, onCancel }: { onCreated: (post: ScheduledPostRow) => void; onCancel: () => void }) {
  const [platform, setPlatform] = useState<Platform>('tiktok');
  const [publishAt, setPublishAt] = useState(defaultPublishTime);
  const [caption, setCaption] = useState('');
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<'draft' | 'scheduled' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save(status: 'draft' | 'scheduled') {
    if (!publishAt) {
      setError('Choose a publish date and time.');
      return;
    }
    setBusy(status);
    setError(null);
    try {
      const { post } = await api<{ post: ScheduledPostRow }>('/api/schedule', {
        method: 'POST',
        body: JSON.stringify({
          platform,
          publishAt: new Date(publishAt).toISOString(),
          caption,
          mediaUrls: mediaUrl ? [mediaUrl] : [],
          status,
        }),
      });
      onCreated(post);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the post.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save('draft');
      }}
      className="rounded-2xl border border-neutral-800 bg-neutral-900/40 p-4 sm:p-5 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold">New post</h2>
        <button type="button" onClick={onCancel} className="text-neutral-500 hover:text-neutral-200" aria-label="Close new post form">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs text-neutral-400">
          Platform
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value as Platform)}
            className="w-full h-10 rounded-lg bg-neutral-900 border border-neutral-800 px-3 text-sm text-neutral-100"
          >
            {PLATFORMS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-neutral-400">
          Publish at (your local time)
          <input
            type="datetime-local"
            required
            value={publishAt}
            onChange={(e) => setPublishAt(e.target.value)}
            className="w-full h-10 rounded-lg bg-neutral-900 border border-neutral-800 px-3 text-sm text-neutral-100"
          />
        </label>
      </div>
      <label className="block space-y-1 text-xs text-neutral-400">
        Caption
        <textarea
          value={caption}
          maxLength={MAX_CAPTION}
          onChange={(e) => setCaption(e.target.value)}
          rows={3}
          className="w-full rounded-lg bg-neutral-900 border border-neutral-800 p-3 text-sm text-neutral-100"
          placeholder="What should the post say?"
        />
        <span className="block text-right text-[10px] text-neutral-600">
          {caption.length}/{MAX_CAPTION}
        </span>
      </label>
      <VideoField mediaUrl={mediaUrl} disabled={busy !== null} onChange={setMediaUrl} />
      {error && <ErrorNotice message={error} />}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="submit" variant="outline" disabled={busy !== null}>
          {busy === 'draft' ? <Loader2 className="w-4 h-4 animate-spin" aria-label="Saving" /> : 'Save as draft'}
        </Button>
        <Button
          type="button"
          onClick={() => save('scheduled')}
          disabled={busy !== null}
          className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold"
        >
          {busy === 'scheduled' ? <Loader2 className="w-4 h-4 animate-spin" aria-label="Scheduling" /> : 'Schedule'}
        </Button>
      </div>
    </form>
  );
}

function PostCard({
  post,
  onUpdated,
  onDeleted,
}: {
  post: ScheduledPostRow;
  onUpdated: (post: ScheduledPostRow) => void;
  onDeleted: (id: string) => void;
}) {
  const editable = post.status === 'draft' || post.status === 'scheduled' || post.status === 'failed';
  const [publishAt, setPublishAt] = useState(toLocalInputValue(post.publish_at));
  const [caption, setCaption] = useState(post.caption ?? '');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dirty = publishAt !== toLocalInputValue(post.publish_at) || caption !== (post.caption ?? '');

  async function patch(fields: Record<string, unknown>, label: string) {
    setBusy(label);
    setError(null);
    try {
      const { post: updated } = await api<{ post: ScheduledPostRow }>(`/api/schedule/${post.id}`, {
        method: 'PATCH',
        body: JSON.stringify(fields),
      });
      onUpdated(updated);
      setPublishAt(toLocalInputValue(updated.publish_at));
      setCaption(updated.caption ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update the post.');
    } finally {
      setBusy(null);
    }
  }

  async function remove() {
    setBusy('delete');
    setError(null);
    try {
      await api(`/api/schedule/${post.id}`, { method: 'DELETE' });
      onDeleted(post.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the post.');
      setBusy(null);
      setConfirmDelete(false);
    }
  }

  const disabled = busy !== null || !editable;

  return (
    <li className="rounded-xl bg-neutral-950 border border-neutral-800 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-mono uppercase text-amber-400">{LABEL[post.platform]}</span>
        <span className={`text-[10px] font-mono uppercase rounded-full border px-2 py-0.5 ${STATUS_STYLE[post.status]}`}>
          {post.status}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-[auto,1fr]">
        <label className="space-y-1 text-[11px] text-neutral-500">
          Publish at
          <input
            type="datetime-local"
            value={publishAt}
            disabled={disabled}
            onChange={(e) => setPublishAt(e.target.value)}
            className="block w-full h-10 bg-neutral-900 border border-neutral-800 rounded-lg px-2 text-sm text-neutral-200 disabled:opacity-60"
          />
        </label>
        <label className="space-y-1 text-[11px] text-neutral-500">
          Caption
          <textarea
            value={caption}
            maxLength={MAX_CAPTION}
            disabled={disabled}
            rows={2}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="(no caption)"
            className="block w-full rounded-lg bg-neutral-900 border border-neutral-800 p-2 text-sm text-neutral-200 disabled:opacity-60"
          />
        </label>
      </div>

      <VideoField
        mediaUrl={post.media_urls[0] ?? null}
        disabled={disabled}
        onChange={(url) => patch({ mediaUrls: url ? [url] : [] }, 'media')}
      />

      {post.status === 'failed' && post.publish_error && (
        <p className="text-xs text-rose-300 break-words">Publishing failed: {post.publish_error}</p>
      )}
      {post.status === 'published' && post.published_at && (
        <p className="text-xs text-emerald-300">Published {new Date(post.published_at).toLocaleString()}</p>
      )}
      {post.status === 'publishing' && <p className="text-xs text-sky-300">Publishing now. This can take a few minutes.</p>}

      {error && <ErrorNotice message={error} />}

      {editable && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {dirty && (
            <Button
              size="sm"
              disabled={busy !== null}
              onClick={() =>
                patch({ publishAt: new Date(publishAt).toISOString(), caption }, 'save')
              }
            >
              {busy === 'save' ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-label="Saving" /> : 'Save changes'}
            </Button>
          )}
          {post.status === 'scheduled' ? (
            <Button size="sm" variant="outline" disabled={busy !== null || dirty} onClick={() => patch({ status: 'draft' }, 'status')}>
              {busy === 'status' ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-label="Updating" /> : 'Move to drafts'}
            </Button>
          ) : (
            <Button
              size="sm"
              disabled={busy !== null || dirty}
              onClick={() => patch({ status: 'scheduled' }, 'status')}
              className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold"
              title={dirty ? 'Save your changes first' : undefined}
            >
              {busy === 'status' ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-label="Scheduling" /> : 'Schedule'}
            </Button>
          )}
          <div className="ml-auto">
            {confirmDelete ? (
              <span className="flex items-center gap-2 text-xs text-neutral-400">
                Delete this post?
                <Button size="sm" variant="outline" disabled={busy !== null} onClick={remove}>
                  {busy === 'delete' ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-label="Deleting" /> : 'Delete'}
                </Button>
                <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => setConfirmDelete(false)}>
                  Keep
                </Button>
              </span>
            ) : (
              <Button size="sm" variant="ghost" disabled={busy !== null} onClick={() => setConfirmDelete(true)} aria-label="Delete post">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

export function ScheduleCalendar() {
  const [posts, setPosts] = useState<ScheduledPostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchPosts = useCallback(async () => {
    setLoadError(null);
    try {
      const { posts } = await api<{ posts: ScheduledPostRow[] }>('/api/schedule');
      setPosts(sortPosts(posts));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load your calendar.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Initial load; fetchPosts only sets state after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchPosts();
  }, [fetchPosts]);

  async function handleGenerate() {
    setGenerating(true);
    setGenerateError(null);
    try {
      await api('/api/schedule/generate', { method: 'POST' });
      await fetchPosts();
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Calendar generation failed.');
    } finally {
      setGenerating(false);
    }
  }

  const upcoming = posts.filter((p) => p.status !== 'published');
  const published = posts.filter((p) => p.status === 'published');

  const replace = (updated: ScheduledPostRow) =>
    setPosts((prev) => sortPosts(prev.map((p) => (p.id === updated.id ? updated : p))));
  const drop = (id: string) => setPosts((prev) => prev.filter((p) => p.id !== id));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-neutral-500">
          Posts publish automatically at their time once scheduled, through your{' '}
          <Link href="/dashboard/settings/connections" className="text-amber-400 hover:text-amber-300">
            connected accounts
          </Link>
          .
        </p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCreating(true)} disabled={creating}>
            <Plus className="w-4 h-4" aria-hidden /> New post
          </Button>
          <Button onClick={handleGenerate} disabled={generating} className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold">
            {generating ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-label="Generating" />
            ) : (
              <>
                <Sparkles className="w-4 h-4" aria-hidden /> Suggest this week
              </>
            )}
          </Button>
        </div>
      </div>
      <p className="text-[11px] text-neutral-600">
        &ldquo;Suggest this week&rdquo; uses one analysis and adds draft slots at recommended times.
      </p>

      {generateError && <ErrorNotice message={generateError} />}

      {creating && (
        <NewPostForm
          onCancel={() => setCreating(false)}
          onCreated={(post) => {
            setPosts((prev) => sortPosts([...prev, post]));
            setCreating(false);
          }}
        />
      )}

      {loading ? (
        <div className="py-16 flex justify-center text-neutral-500" aria-busy="true">
          <Loader2 className="w-6 h-6 animate-spin" aria-label="Loading your calendar" />
        </div>
      ) : loadError ? (
        <div className="space-y-3">
          <ErrorNotice message={loadError} />
          <Button variant="outline" onClick={() => fetchPosts()}>
            Try again
          </Button>
        </div>
      ) : posts.length === 0 ? (
        <div className="py-16 text-center text-sm text-neutral-500 flex flex-col items-center gap-2">
          <CalendarClock className="w-6 h-6" aria-hidden />
          Nothing planned yet. Add a post, or let us suggest a week of slots.
        </div>
      ) : (
        <>
          {upcoming.length > 0 && (
            <section className="space-y-3" aria-labelledby="upcoming">
              <h2 id="upcoming" className="text-xs font-mono uppercase tracking-widest text-neutral-500">
                Upcoming and drafts
              </h2>
              <ul className="space-y-3">
                {upcoming.map((post) => (
                  <PostCard key={`${post.id}-${post.updated_at}`} post={post} onUpdated={replace} onDeleted={drop} />
                ))}
              </ul>
            </section>
          )}
          {published.length > 0 && (
            <section className="space-y-3" aria-labelledby="published">
              <h2 id="published" className="text-xs font-mono uppercase tracking-widest text-neutral-500">
                Published
              </h2>
              <ul className="space-y-3">
                {published.map((post) => (
                  <PostCard key={post.id} post={post} onUpdated={replace} onDeleted={drop} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
