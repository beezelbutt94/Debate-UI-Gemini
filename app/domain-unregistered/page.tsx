'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DomainUnregisteredPage() {
  return (
    <Suspense fallback={null}>
      <DomainUnregisteredContent />
    </Suspense>
  );
}

function DomainUnregisteredContent() {
  const searchParams = useSearchParams();
  const host = searchParams.get('host') || 'This domain';

  return (
    <div className="min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-6 text-neutral-100">
      <div className="w-full max-w-md p-8 bg-neutral-900/60 border border-neutral-800 rounded-2xl shadow-2xl text-center space-y-6">
        <div className="w-12 h-12 rounded-2xl bg-rose-950/60 border border-rose-800 flex items-center justify-center mx-auto text-rose-400">
          <ShieldX className="w-6 h-6" />
        </div>

        <div className="space-y-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-neutral-500">Routing Status 404</span>
          <h1 className="text-xl font-bold text-white">Domain Disconnected</h1>
          <p className="text-xs text-neutral-400 leading-relaxed font-mono">
            <span className="text-rose-400 font-bold">{host}</span> is not mapped to an active workspace.
          </p>
        </div>

        <div className="p-4 bg-neutral-950 border border-neutral-800/80 rounded-xl text-xs text-neutral-400 text-left space-y-2 font-mono">
          <span className="text-[10px] uppercase text-neutral-500 font-bold block">Why am I seeing this?</span>
          <ul className="list-disc list-inside space-y-1 text-[11px] text-neutral-400">
            <li>The workspace owner removed this custom domain.</li>
            <li>DNS points here, but no workspace has claimed it.</li>
            <li>Edge SSL certificates were revoked.</li>
          </ul>
        </div>

        <div className="pt-2 flex flex-col gap-2">
          <Link href="/">
            <Button className="w-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-bold text-xs py-2.5">
              Go to the platform <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
