import Link from 'next/link';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { formatDateTime } from '@/lib/report-meta';

export const metadata = { title: 'Admin · Activity' };

const LEVELS = ['all', 'error', 'warn', 'info'] as const;
const PAGE_SIZE = 100;

const LEVEL_STYLE: Record<string, string> = {
  error: 'text-rose-300',
  warn: 'text-amber-300',
  info: 'text-neutral-400',
};

export default async function AdminEvents({ searchParams }: { searchParams: Promise<{ level?: string; page?: string }> }) {
  const { level: rawLevel = 'all', page = '1' } = await searchParams;
  const level = (LEVELS as readonly string[]).includes(rawLevel) ? rawLevel : 'all';
  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);

  let request = createSupabaseAdminClient()
    .from('app_events')
    .select('id, created_at, level, event, user_id, detail')
    .order('created_at', { ascending: false })
    .range((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE);
  if (level !== 'all') request = request.eq('level', level);

  const { data, error } = await request;
  const rows = (data ?? []).slice(0, PAGE_SIZE);
  const hasMore = (data?.length ?? 0) > PAGE_SIZE;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <h1 className="text-2xl font-black">Activity &amp; errors</h1>
        <nav aria-label="Filter by level" className="flex flex-wrap gap-2">
          {LEVELS.map((l) => (
            <Link
              key={l}
              href={`/admin/events?level=${l}`}
              aria-current={l === level ? 'page' : undefined}
              className={`rounded-full border px-3 py-1 text-xs font-mono ${l === level ? 'border-amber-600 text-amber-400' : 'border-neutral-800 text-neutral-400 hover:border-neutral-600'}`}
            >
              {l}
            </Link>
          ))}
        </nav>
      </header>

      {error && <p className="text-sm text-rose-300">Could not load events. Has migration 0006 been applied?</p>}

      {rows.length === 0 && !error ? (
        <p className="text-sm text-neutral-500">No events recorded{level !== 'all' ? ` at level “${level}”` : ''}.</p>
      ) : (
        <ul className="divide-y divide-neutral-800 rounded-xl border border-neutral-800">
          {rows.map((e) => (
            <li key={e.id} className="p-3 text-xs space-y-1">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <span className={`font-mono break-all ${LEVEL_STYLE[e.level] ?? ''}`}>
                  [{e.level}] {e.event}
                </span>
                <span className="text-neutral-500 shrink-0">{formatDateTime(e.created_at)}</span>
              </div>
              {e.user_id && <p className="font-mono text-[10px] text-neutral-600 break-all">user {e.user_id}</p>}
              {e.detail && Object.keys(e.detail).length > 0 && (
                <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded bg-neutral-900/60 p-2 text-[10px] text-neutral-400">
                  {JSON.stringify(e.detail, null, 2)}
                </pre>
              )}
            </li>
          ))}
        </ul>
      )}

      <nav aria-label="Pagination" className="flex items-center justify-between text-xs">
        {pageNum > 1 ? (
          <Link href={`/admin/events?level=${level}&page=${pageNum - 1}`} className="text-amber-400">
            Newer
          </Link>
        ) : (
          <span />
        )}
        {hasMore && (
          <Link href={`/admin/events?level=${level}&page=${pageNum + 1}`} className="text-amber-400">
            Older
          </Link>
        )}
      </nav>
    </div>
  );
}
