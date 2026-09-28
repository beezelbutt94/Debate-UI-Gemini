"use client";

import { Activity, X } from "lucide-react";
import { ApprovalQueue } from "@/components/ApprovalQueue";
import { DispatchBar } from "@/components/DispatchBar";
import { AdsPanel, BriefingPanel, DeliverabilityPanel, DemosPanel, IncidentsPanel, IntelPanel, SpendPanel } from "@/components/panels";
import { RunCard } from "@/components/RunCard";
import { Pill } from "@/components/ui";
import { useLiveFeed, useResource } from "@/hooks/useLiveFeed";
import type {
  AdRecommendation,
  AgentInfo,
  Approval,
  Briefing,
  CampaignHealth,
  Demo,
  Health,
  Incident,
  Intel,
  SpendReport,
} from "@/lib/types";

const ALERT_STYLE = {
  info: "border-sky-500/30 bg-sky-500/10 text-sky-200",
  warn: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  danger: "border-rose-500/30 bg-rose-500/10 text-rose-200",
};

export default function CommandCenter() {
  const { runs, connected, version, alerts, dismiss } = useLiveFeed();
  const health = useResource<Health>("/health", version);
  const agents = useResource<AgentInfo[]>("/agents", 0);
  const approvals = useResource<Approval[]>("/approvals/pending", version);
  const spend = useResource<SpendReport>("/spend", version);
  const briefing = useResource<Briefing | null>("/orchestrator/briefing", version);
  const incidents = useResource<Incident[]>("/incidents", version);
  const deliverability = useResource<CampaignHealth[]>("/deliverability", version);
  const ads = useResource<{ recommendation: AdRecommendation[] }>("/ads/arms", version);
  const demos = useResource<Demo[]>("/demos", version);
  const intel = useResource<{ intel: Intel[] }>("/competitors", version);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">
      <header className="flex flex-col gap-3 border-b border-zinc-800 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight text-white">
            <Activity className="h-5 w-5 text-zinc-400" /> Polsia Command Center
          </h1>
          <p className="mt-1 font-mono text-xs text-zinc-500">Autonomous agent swarm · human approval on every irreversible action</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {health.data && (
            <>
              <Pill tone={health.data.llm_mode === "claude_code" ? "violet" : "zinc"}>
                {health.data.llm_mode === "claude_code" ? "Claude Code" : "simulated LLM"}
              </Pill>
              <Pill tone={health.data.sandbox_mode ? "amber" : "rose"}>{health.data.sandbox_mode ? "sandbox" : "live side effects"}</Pill>
            </>
          )}
          <Pill tone={connected ? "emerald" : "rose"}>
            <span className={`h-1.5 w-1.5 rounded-full ${connected ? "animate-pulse bg-emerald-400" : "bg-rose-400"}`} />
            {connected ? "feed live" : "reconnecting"}
          </Pill>
        </div>
      </header>

      {alerts.length > 0 && (
        <div className="mt-4 space-y-2">
          {alerts.map((a) => (
            <div key={a.id} className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${ALERT_STYLE[a.tone]}`}>
              <span>{a.text}</span>
              <button onClick={() => dismiss(a.id)} aria-label="Dismiss">
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <DispatchBar agents={agents.data ?? []} />
          {!health.data && health.error && (
            <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 font-mono text-xs text-rose-300">
              API unreachable ({health.error}). Is the backend running on {process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}?
            </p>
          )}
          {runs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 py-20 text-center font-mono text-sm text-zinc-500">
              No runs yet. Dispatch a directive above or wait for the schedule.
            </div>
          ) : (
            runs.map((run) => <RunCard key={run.id} run={run} />)
          )}
        </div>

        <aside className="min-w-0 space-y-4">
          <ApprovalQueue approvals={approvals.data} error={approvals.error} />
          <BriefingPanel {...briefing} />
          <SpendPanel {...spend} />
          <IncidentsPanel {...incidents} />
          <DeliverabilityPanel {...deliverability} />
          <AdsPanel {...ads} />
          <DemosPanel {...demos} />
          <IntelPanel {...intel} />
        </aside>
      </div>
    </main>
  );
}
