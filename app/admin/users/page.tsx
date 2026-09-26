import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { ResetUsageButton } from '@/components/admin/ResetUsageButton';
import { PLAN_INFO, type PlanTier } from '@/lib/plans';
import { formatDateTime } from '@/lib/report-meta';

export const metadata = { title: 'Admin · Users' };

const PAGE_SIZE = 50;

interface SubInfo {
  plan_tier: PlanTier;
  status: string;
  quota_analyses_used: number;
  quota_analyses_limit: number;
  cancel_at_period_end: boolean;
}

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const { q = '', page = '1' } = await searchParams;
  const pageNum = Math.max(1, Number.parseInt(page, 10) || 1);
  const query = q.trim().slice(0, 100);

  let request = createSupabaseAdminClient()
    .from('users')
    .select('id, email, created_at, subscriptions(plan_tier, status, quota_analyses_used, quota_analyses_limit, cancel_at_period_end)', {
      count: 'exact',
    })
    .order('created_at', { ascending: false })
    .range((pageNum - 1) * PAGE_SIZE, pageNum * PAGE_SIZE - 1);

  if (query) {
    // Escape LIKE wildcards so the search is a literal substring match.
    const literal = query.replace(/[\\%_]/g, (c) => `\\${c}`);
    request = query.startsWith('user_') ? request.eq('id', query) : request.ilike('email', `%${literal}%`);
  }

  const { data, count, error } = await request;
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-black">Users</h1>
          <p className="text-xs text-neutral-500 mt-1">{total} total</p>
        </div>
        <form className="flex gap-2 w-full sm:w-auto" role="search">
          <label htmlFor="user-search" className="sr-only">
            Search by email or user id
          </label>
          <input
            id="user-search"
            name="q"
            defaultValue={query}
            placeholder="Email or user_…"
            className="h-10 min-w-0 flex-1 sm:flex-none sm:w-64 rounded-lg bg-neutral-900 border border-neutral-800 px-3 text-sm"
          />
          <button type="submit" className="h-10 rounded-lg border border-neutral-800 px-4 text-sm hover:bg-neutral-900">
            Search
          </button>
        </form>
      </header>

      {error && <p className="text-sm text-rose-300">Could not load users.</p>}

      <div className="relative overflow-x-auto rounded-xl border border-neutral-800">
        <table className="w-full min-w-[640px] text-xs">
          <thead className="bg-neutral-900/60 text-left text-neutral-500">
            <tr>
              <th scope="col" className="p-3 font-medium">User</th>
              <th scope="col" className="p-3 font-medium">Plan</th>
              <th scope="col" className="p-3 font-medium">Usage</th>
              <th scope="col" className="p-3 font-medium">Joined</th>
              <th scope="col" className="p-3 font-medium"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800">
            {(data ?? []).map((u) => {
              const raw = u.subscriptions as unknown;
              const sub = (Array.isArray(raw) ? raw[0] : raw) as SubInfo | null;
              return (
                <tr key={u.id}>
                  <td className="p-3">
                    <p className="text-neutral-200 break-all">{u.email}</p>
                    <p className="font-mono text-[10px] text-neutral-600 break-all">{u.id}</p>
                  </td>
                  <td className="p-3">
                    {sub ? (
                      <>
                        <span className="text-amber-400">{PLAN_INFO[sub.plan_tier]?.name ?? sub.plan_tier}</span>
                        <span className="block text-[10px] text-neutral-500">
                          {sub.status}
                          {sub.cancel_at_period_end ? ' · cancelling' : ''}
                        </span>
                      </>
                    ) : (
                      <span className="text-neutral-600">no plan row</span>
                    )}
                  </td>
                  <td className="p-3 font-mono">{sub ? `${sub.quota_analyses_used}/${sub.quota_analyses_limit}` : '—'}</td>
                  <td className="p-3 text-neutral-400">{formatDateTime(u.created_at)}</td>
                  <td className="p-3 text-right">{sub && <ResetUsageButton userId={u.id} disabled={sub.quota_analyses_used === 0} />}</td>
                </tr>
              );
            })}
            {(data?.length ?? 0) === 0 && !error && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-neutral-500">
                  {query ? 'No users match that search.' : 'No users yet.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <nav aria-label="Pagination" className="flex items-center justify-between text-xs">
          {pageNum > 1 ? (
            <a href={`?q=${encodeURIComponent(query)}&page=${pageNum - 1}`} className="text-amber-400">
              Previous
            </a>
          ) : (
            <span />
          )}
          <span className="text-neutral-500">
            Page {pageNum} of {pages}
          </span>
          {pageNum < pages ? (
            <a href={`?q=${encodeURIComponent(query)}&page=${pageNum + 1}`} className="text-amber-400">
              Next
            </a>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
