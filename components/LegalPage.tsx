import Link from 'next/link';
import { SiteFooter } from '@/components/SiteFooter';

/** Shared frame for /privacy and /terms, matching the Help page. */
export function LegalPage({ eyebrow, title, updated, children }: {
  eyebrow: string;
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      <div className="max-w-3xl mx-auto px-4 py-8 sm:p-10 space-y-8">
        <nav aria-label="Breadcrumb" className="flex items-center justify-between text-xs">
          <Link href="/" className="inline-flex items-center min-h-[40px] font-black text-sm">
            Viral Trending
          </Link>
          <Link href="/help" className="inline-flex items-center min-h-[40px] px-2 text-amber-400 hover:text-amber-300">
            Help
          </Link>
        </nav>
        <header className="border-b border-neutral-800 pb-6">
          <span className="text-[10px] font-mono text-amber-500 uppercase tracking-widest">{eyebrow}</span>
          <h1 className="text-2xl font-black mt-1">{title}</h1>
          <p className="text-xs text-neutral-500 mt-2">Last updated {updated}</p>
        </header>
        <div className="space-y-6 text-sm text-neutral-400 leading-relaxed [&_h2]:font-bold [&_h2]:text-neutral-200 [&_h2]:text-base [&_h2]:mb-2 [&_a]:text-amber-400 [&_a:hover]:text-amber-300 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
          {children}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
