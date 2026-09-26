import Link from 'next/link';
import { notFound } from 'next/navigation';
import { isAdmin } from '@/lib/admin-access';

export const dynamic = 'force-dynamic';

/**
 * Every /admin page renders inside this layout, so the allowlist check here
 * covers them all. Non-admins get a plain 404: the area's existence is not
 * revealed. The /api/admin routes repeat the check themselves.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) notFound();

  const links = [
    { href: '/admin', label: 'Overview' },
    { href: '/admin/users', label: 'Users' },
    { href: '/admin/events', label: 'Activity & errors' },
    { href: '/dashboard', label: 'Back to app' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 sm:p-8 text-neutral-100 min-h-screen space-y-8">
      <nav aria-label="Admin" className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-neutral-800 pb-4">
        <span className="text-sm font-black">
          Viral Trending <span className="text-amber-400">Admin</span>
        </span>
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="inline-flex items-center min-h-[36px] px-1 text-xs font-mono text-neutral-400 hover:text-amber-400">
            {l.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
