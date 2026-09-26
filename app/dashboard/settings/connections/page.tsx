import { DashboardNav } from '@/components/DashboardNav';
import { ConnectionsPanel } from '@/components/ConnectionsPanel';

const OAUTH_STATUS_MESSAGES: Record<string, { text: string; tone: 'success' | 'error' }> = {
  connected: { text: 'Connected.', tone: 'success' },
  state_mismatch: { text: 'That connect link expired or was tampered with -- try connecting again.', tone: 'error' },
  missing_code: { text: 'The provider did not return an authorization code.', tone: 'error' },
  exchange_failed: { text: 'Could not exchange the authorization code for a token. Check server logs for details.', tone: 'error' },
  store_failed: { text: 'The connection succeeded but could not be saved. Try again.', tone: 'error' },
  unauthenticated: { text: 'Sign in before connecting a platform.', tone: 'error' },
};

export default async function ConnectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ oauth?: string; platform?: string }>;
}) {
  const { oauth, platform } = await searchParams;
  const status = oauth ? OAUTH_STATUS_MESSAGES[oauth] : null;

  return (
    <div className="max-w-3xl mx-auto p-8 text-neutral-100 min-h-screen space-y-8">
      <DashboardNav />
      <div className="border-b border-neutral-800 pb-6">
        <span className="text-[10px] font-mono text-amber-500 uppercase tracking-widest">Connections</span>
        <h1 className="text-2xl font-black mt-1">Connect the platforms Viral Trending publishes to</h1>
        <p className="text-xs text-neutral-500 mt-2 max-w-xl">
          Each connection is your own OAuth grant to your own account -- Viral Trending never has a shared,
          platform-owned account it posts from. Scheduled posts on the Schedule page publish through these
          connections once their publish time passes.
        </p>
      </div>

      {status && (
        <div
          className={`p-3 rounded-lg text-xs font-mono ${
            status.tone === 'success'
              ? 'bg-emerald-950/40 border border-emerald-900 text-emerald-300'
              : 'bg-rose-950/40 border border-rose-900 text-rose-200'
          }`}
        >
          {platform ? `${platform}: ` : ''}
          {status.text}
        </div>
      )}

      <ConnectionsPanel />
    </div>
  );
}
