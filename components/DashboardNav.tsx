import { isAdmin } from '@/lib/admin-access';
import { NavMenu } from '@/components/NavMenu';

/**
 * Explicitly imported by each Viral Trending dashboard page rather than
 * hoisted into app/dashboard/layout.tsx, since that layout would also
 * wrap the separate, pre-existing platform-scaffold pages under
 * app/dashboard/* (trends, settings/domain, renders/[id]) — this keeps
 * Viral Trending's nav from leaking onto that unrelated, unbuilt scaffold.
 *
 * The admin link is decided here, on the server; the /admin routes enforce
 * the same check themselves, so hiding the link is convenience, not
 * protection.
 */
export async function DashboardNav() {
  const admin = await isAdmin();
  return <NavMenu isAdmin={admin} />;
}
