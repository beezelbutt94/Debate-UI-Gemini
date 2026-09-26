import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md text-center space-y-4">
        <p className="text-xs font-mono text-amber-500">404</p>
        <h1 className="text-2xl font-black">Page not found</h1>
        <p className="text-sm text-neutral-400">
          This page doesn&apos;t exist, or it belongs to another account.
        </p>
        <div className="flex justify-center gap-2">
          <Link
            href="/dashboard"
            className="inline-flex h-10 items-center rounded-lg bg-amber-500 px-4 text-sm font-bold text-neutral-950 hover:bg-amber-400"
          >
            Go to dashboard
          </Link>
          <Link href="/" className="inline-flex h-10 items-center rounded-lg border border-neutral-800 px-4 text-sm hover:bg-neutral-900">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
