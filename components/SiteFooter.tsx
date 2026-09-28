import Link from 'next/link';
import { STUDIOFORGE_URL } from '@/lib/site';

const LINK = 'inline-flex items-center min-h-[40px] px-2 hover:text-neutral-300';

/** Footer for the public pages: help, legal pages and the sister audio app. */
export function SiteFooter() {
  return (
    <footer className="border-t border-neutral-900 py-6 text-center text-xs text-neutral-600">
      <nav aria-label="Site" className="flex flex-wrap items-center justify-center gap-x-2">
        <Link href="/help" className={LINK}>
          Help &amp; FAQ
        </Link>
        <Link href="/privacy" className={LINK}>
          Privacy
        </Link>
        <Link href="/terms" className={LINK}>
          Terms
        </Link>
        <a href={STUDIOFORGE_URL} className={LINK}>
          StudioForge AI: stems, mashups &amp; mastering
        </a>
      </nav>
    </footer>
  );
}
