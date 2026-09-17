import Link from 'next/link';
import { UserButton } from '@clerk/nextjs';

const NAV_ITEMS = [
  { href: '/dashboard/analyze', label: 'Viral Gap Analyzer' },
  { href: '/dashboard/deep-dive', label: 'Account Deep-Dive' },
  { href: '/dashboard/upload', label: 'Upload Diagnostic' },
  { href: '/dashboard/script', label: 'Script Generator' },
  { href: '/dashboard/tools', label: 'Tool Suite Hub' },
  { href: '/dashboard/competitors', label: 'Competitor Espionage' },
  { href: '/dashboard/discover', label: 'Web Discovery' },
  { href: '/dashboard/schedule', label: 'Schedule' },
  { href: '/dashboard/settings/connections', label: 'Connections' },
];

/**
 * Explicitly imported by each ViralEngine dashboard page rather than
 * hoisted into app/dashboard/layout.tsx, since that layout would also
 * wrap the separate, pre-existing ViralVision scaffold pages under
 * app/dashboard/* (trends, settings/domain, renders/[id]) — this keeps
 * ViralEngine's nav from leaking onto that unrelated, unbuilt scaffold.
 */
export function DashboardNav() {
  return (
    <nav className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-6">
        <Link href="/" className="text-sm font-black text-neutral-100">
          ViralEngine
        </Link>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-xs font-mono text-neutral-400 hover:text-amber-400 transition-colors"
          >
            {item.label}
          </Link>
        ))}
      </div>
      <UserButton />
    </nav>
  );
}
