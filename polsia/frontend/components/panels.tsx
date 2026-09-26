"use client";

import { useState } from "react";
import { ExternalLink, Sparkles } from "lucide-react";
import { post, timeAgo } from "@/lib/api";
import type { AdRecommendation, Briefing, CampaignHealth, Demo, Incident, Intel, SpendReport } from "@/lib/types";
import { Button, Empty, ErrorLine, Panel, Pill } from "./ui";

type Loaded<T> = { data: T | null; error: string | null };

export function SpendPanel({ data, error }: Loaded<SpendReport>) {
  return (
    <Panel title="LLM spend today">
      <ErrorLine error={error} />
      {data && (
        <>
          <p className="font-mono text-2xl text-zinc-100">
            ${data.total_usd.toFixed(2)}
            <span className="ml-2 text-xs text-zinc-500">of ${data.global_cap_usd.toFixed(0)} global cap</span>
          </p>
          <ul className="mt-3 space-y-2">
            {data.agents.map((a) => {
              const pct = Math.min(100, (a.cost_usd / a.cap_usd) * 100);
              return (
                <li key={a.agent}>
                  <div className="flex justify-between font-mono text-[11px] text-zinc-400">
                    <span>{a.agent}</span>
                    <span className={a.locked ? "text-rose-400" : ""}>
                      ${a.cost_usd.toFixed(2)} / ${a.cap_usd.toFixed(0)} · {a.calls} calls
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded bg-zinc-800">
                    <div
                      className={`h-1.5 rounded ${a.locked ? "bg-rose-500" : pct > 75 ? "bg-amber-400" : "bg-emerald-500"}`}
                      style={{ width: `${Math.max(pct, 1)}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          {data.agents.length === 0 && <Empty>No model calls yet today.</Empty>}
        </>
      )}
    </Panel>
  );
}

export function BriefingPanel({ data, error }: Loaded<Briefing | null>) {
  const [busy, setBusy] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true);
    setRunError(null);
    try {
      await post("/orchestrator/run");
    } catch (err) {
      setRunError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel
      title="CEO briefing"
      action={
        <Button onClick={run} disabled={busy}>
          <Sparkles className="h-3.5 w-3.5" /> Run cycle
        </Button>
      }
    >
      <ErrorLine error={error ?? runError} />
      {data ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-zinc-100">{data.okr_focus}</p>
          <p className="text-xs text-zinc-400">{data.summary}</p>
          <ul className="space-y-1">
            {data.delegated_tasks.map((t, i) => (
              <li key={i} className="font-mono text-[11px] text-zinc-400">
                → <span className="text-violet-300">{t.agent}</span>: {t.instruction}
              </li>
            ))}
          </ul>
          <p className="font-mono text-[11px] text-zinc-600">{timeAgo(data.created_at)}</p>
        </div>
      ) : (
        <Empty>No briefing yet. The orchestrator runs daily at 06:00 UTC.</Empty>
      )}
    </Panel>
  );
}

const INCIDENT_TONE: Record<string, "rose" | "amber" | "emerald" | "zinc"> = {
  REVERT_PENDING_APPROVAL: "amber",
  REVERT_OPENED: "emerald",
  REVERT_FAILED: "rose",
  UNCORRELATED: "zinc",
  DUPLICATE: "zinc",
};

export function IncidentsPanel({ data, error }: Loaded<Incident[]>) {
  return (
    <Panel title="Incidents">
      <ErrorLine error={error} />
      {!data?.length ? (
        <Empty>No incidents recorded.</Empty>
      ) : (
        <ul className="space-y-2">
          {data.slice(0, 6).map((i) => (
            <li key={i.id} className="text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-zinc-200">{i.title}</span>
                <Pill tone={INCIDENT_TONE[i.status] ?? "rose"}>{i.status.replaceAll("_", " ").toLowerCase()}</Pill>
              </div>
              <div className="mt-0.5 flex gap-2 font-mono text-[11px] text-zinc-500">
                {i.commit_sha && <span>{i.commit_sha.slice(0, 8)}</span>}
                <span>{timeAgo(i.created_at)}</span>
                {i.revert_pr_url && (
                  <a href={i.revert_pr_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-sky-400">
                    revert PR <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function DeliverabilityPanel({ data, error }: Loaded<CampaignHealth[]>) {
  return (
    <Panel title="Email deliverability">
      <ErrorLine error={error} />
      {!data?.length ? (
        <Empty>No outreach campaigns yet.</Empty>
      ) : (
        <ul className="space-y-2">
          {data.map((c) => (
            <li key={c.campaign} className="text-xs">
              <div className="flex items-center justify-between">
                <span className="font-mono text-zinc-200">{c.campaign}</span>
                {c.paused ? (
                  <Button variant="danger" onClick={() => post(`/deliverability/${encodeURIComponent(c.campaign)}/resume`)}>
                    Paused · resume
                  </Button>
                ) : (
                  <Pill tone="emerald">sending</Pill>
                )}
              </div>
              <p className="mt-0.5 font-mono text-[11px] text-zinc-500">
                {c.bounced}/{c.sent} bounced ({(c.bounce_rate * 100).toFixed(1)}%, limit {(c.threshold * 100).toFixed(0)}%)
              </p>
              {c.pause_reason && <p className="text-[11px] text-rose-400">{c.pause_reason}</p>}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function AdsPanel({ data, error }: Loaded<{ recommendation: AdRecommendation[] }>) {
  const plan = data?.recommendation ?? [];
  return (
    <Panel title="Ad budget (Thompson sampling)">
      <ErrorLine error={error} />
      {plan.length === 0 ? (
        <Empty>No campaigns registered.</Empty>
      ) : (
        <table className="w-full font-mono text-[11px]">
          <thead className="text-zinc-500">
            <tr>
              <th className="text-left font-normal">Campaign</th>
              <th className="text-right font-normal">ROAS (90% CI)</th>
              <th className="text-right font-normal">P(best)</th>
              <th className="text-right font-normal">Budget</th>
            </tr>
          </thead>
          <tbody className="text-zinc-300">
            {plan.map((p) => (
              <tr key={p.campaign_id}>
                <td className="py-1">{p.name}</td>
                <td className="text-right">
                  {p.expected_roas.toFixed(2)}x <span className="text-zinc-500">({p.roas_90ci[0].toFixed(1)}–{p.roas_90ci[1].toFixed(1)})</span>
                </td>
                <td className="text-right">{(p.p_best * 100).toFixed(0)}%</td>
                <td className="text-right">
                  ${p.daily_budget_usd.toFixed(0)}
                  {p.current_budget_usd > 0 && <span className="text-zinc-500"> (now ${p.current_budget_usd.toFixed(0)})</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

export function DemosPanel({ data, error }: Loaded<Demo[]>) {
  const [busy, setBusy] = useState<string | null>(null);
  const brief = async (id: string) => {
    setBusy(id);
    try {
      await post(`/demos/${id}/briefing`);
    } finally {
      setBusy(null);
    }
  };
  return (
    <Panel title="Upcoming demos">
      <ErrorLine error={error} />
      {!data?.length ? (
        <Empty>No demos booked.</Empty>
      ) : (
        <ul className="space-y-2">
          {data.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 text-xs">
              <div>
                <p className="text-zinc-200">{d.company}</p>
                <p className="font-mono text-[11px] text-zinc-500">{new Date(d.start_time).toLocaleString()}</p>
              </div>
              {d.briefing_id ? (
                <Pill tone="emerald">briefed</Pill>
              ) : (
                <Button disabled={busy === d.id} onClick={() => brief(d.id)}>
                  Brief now
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

const THREAT_TONE = { LOW: "zinc", MEDIUM: "amber", HIGH: "rose" } as const;

export function IntelPanel({ data, error }: Loaded<{ intel: Intel[] }>) {
  const intel = data?.intel ?? [];
  return (
    <Panel title="Competitor intel">
      <ErrorLine error={error} />
      {intel.length === 0 ? (
        <Empty>No competitor changes detected.</Empty>
      ) : (
        <ul className="space-y-2">
          {intel.slice(0, 5).map((m) => (
            <li key={m.id} className="text-xs">
              <div className="flex items-center gap-2">
                <Pill tone={THREAT_TONE[m.threat_level]}>{m.threat_level}</Pill>
                <span className="text-zinc-200">{m.competitor}</span>
              </div>
              <p className="mt-1 text-zinc-400">{m.headline}</p>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
