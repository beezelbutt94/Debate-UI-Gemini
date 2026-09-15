import React from 'react';
import { ServerCog } from 'lucide-react';

/**
 * Shown on the ViralVision dashboard pages when `services/api` isn't
 * reachable — which is the default, since that service isn't deployed.
 * Says so plainly rather than rendering a controls-shaped dead end.
 */
export function PlatformServiceNotice({ feature }: { feature: string }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 space-y-3">
      <div className="flex items-center gap-2 text-amber-500">
        <ServerCog className="w-4 h-4" />
        <span className="text-[10px] font-mono uppercase tracking-widest">Backend not connected</span>
      </div>
      <h3 className="text-base font-bold text-white">{feature} needs the platform service</h3>
      <p className="text-xs text-neutral-400 leading-relaxed">
        This page talks to <code className="text-neutral-200">services/api</code>, the FastAPI
        service that isn&apos;t running in this deployment. Start it and set{' '}
        <code className="text-neutral-200">INTERNAL_API_URL</code> to its address to turn on the{' '}
        <code className="text-neutral-200">/api/v1/*</code> rewrite in{' '}
        <code className="text-neutral-200">next.config.mjs</code>.
      </p>
      <p className="text-xs text-neutral-500">
        See <code className="text-neutral-300">docs/PLATFORM_ROADMAP.md</code> for what that service
        still needs before it can run.
      </p>
    </div>
  );
}

export default PlatformServiceNotice;
