'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { UserButton } from '@clerk/nextjs';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
}

const GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Analyze',
    items: [
      { href: '/dashboard/analyze', label: 'Viral Gap Analyzer' },
      { href: '/dashboard/deep-dive', label: 'Account Deep-Dive' },
      { href: '/dashboard/upload', label: 'Upload Diagnostic' },
    ],
  },
  {
    title: 'Create',
    items: [
      { href: '/dashboard/script', label: 'Script Generator' },
      { href: '/dashboard/tools', label: 'Tool Suite Hub' },
    ],
  },
  {
    title: 'Research',
    items: [
      { href: '/dashboard/competitors', label: 'Competitor Espionage' },
      { href: '/dashboard/discover', label: 'Web Discovery' },
    ],
  },
  {
    title: 'Publish',
    items: [
      { href: '/dashboard/schedule', label: 'Schedule' },
      { href: '/dashboard/settings/connections', label: 'Connections' },
    ],
  },
];

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavMenu({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const accountItems: NavItem[] = [
    { href: '/dashboard/history', label: 'History' },
    { href: '/dashboard/billing', label: 'Billing' },
    { href: '/help', label: 'Help' },
    ...(isAdmin ? [{ href: '/admin', label: 'Admin' }] : []),
  ];

  const link = (item: NavItem, block = false) => (
    <Link
      key={item.href}
      href={item.href}
      onClick={() => setOpen(false)}
      aria-current={isActive(pathname, item.href) ? 'page' : undefined}
      className={cn(
        'rounded-md font-mono transition-colors',
        block ? 'block px-3 py-2.5 text-sm' : 'px-2 py-1 text-xs',
        isActive(pathname, item.href)
          ? 'text-amber-400 bg-amber-950/30'
          : 'text-neutral-400 hover:text-amber-400 hover:bg-neutral-900'
      )}
    >
      {item.label}
    </Link>
  );

  return (
    <nav aria-label="Main" className="border-b border-neutral-800 pb-4">
      <div className="flex items-center justify-between gap-4">
        <Link href="/dashboard" className="inline-flex items-center min-h-[40px] text-sm font-black text-neutral-100 shrink-0">
          Viral Trending
        </Link>

        <div className="hidden lg:flex items-center gap-1 flex-wrap justify-end">
          {accountItems.map((item) => link(item))}
        </div>

        <div className="flex items-center gap-3">
          <UserButton />
          <button
            type="button"
            className="lg:hidden inline-flex h-10 w-10 items-center justify-center rounded-lg border border-neutral-800 text-neutral-300 hover:bg-neutral-900"
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div className="hidden lg:flex flex-wrap items-center gap-x-5 gap-y-2 mt-3">
        {GROUPS.map((group) => (
          <div key={group.title} className="flex items-center gap-1">
            <span className="text-[10px] uppercase tracking-widest text-neutral-600 mr-1">{group.title}</span>
            {group.items.map((item) => link(item))}
          </div>
        ))}
      </div>

      {open && (
        <div id="mobile-nav" className="lg:hidden mt-3 grid gap-4 sm:grid-cols-2">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <p className="px-3 text-[10px] uppercase tracking-widest text-neutral-600 mb-1">{group.title}</p>
              {group.items.map((item) => link(item, true))}
            </div>
          ))}
          <div>
            <p className="px-3 text-[10px] uppercase tracking-widest text-neutral-600 mb-1">Account</p>
            {accountItems.map((item) => link(item, true))}
          </div>
        </div>
      )}
    </nav>
  );
}
