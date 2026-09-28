"use client";

import { useState } from "react";
import { AlertTriangle, Ban, CheckCircle2, ChevronDown, ChevronUp, Clock, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { timeAgo } from "@/lib/api";
import type { AgentRun, RunStatus } from "@/lib/types";
import { Pill, type Tone } from "./ui";

const STATUS: Record<RunStatus, { tone: Tone; label: string; icon: typeof Clock }> = {
  QUEUED: { tone: "zinc", label: "Queued", icon: Clock },
  RUNNING: { tone: "amber", label: "Running", icon: Loader2 },
  COMPLETED: { tone: "emerald", label: "Completed", icon: CheckCircle2 },
  APPROVAL_REQUIRED: { tone: "sky", label: "Awaiting approval", icon: ShieldCheck },
  EXECUTED: { tone: "emerald", label: "Executed", icon: CheckCircle2 },
  REJECTED: { tone: "rose", label: "Rejected", icon: XCircle },
  BLOCKED: { tone: "rose", label: "Budget blocked", icon: Ban },
  FAILED: { tone: "rose", label: "Failed", icon: AlertTriangle },
};

export function RunCard({ run }: { run: AgentRun }) {
  const [open, setOpen] = useState(false);
  const status = STATUS[run.status] ?? STATUS.QUEUED;
  const Icon = status.icon;

  return (
    <article className="min-w-0 rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 transition-colors hover:border-zinc-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Pill tone="violet">{run.agent}</Pill>
          <span className="font-mono text-[11px] text-zinc-500">
            {run.trigger} · {timeAgo(run.created_at)}
            {run.cost_usd > 0 && ` · $${run.cost_usd.toFixed(4)}`}
          </span>
        </div>
        <Pill tone={status.tone}>
          <Icon className={`h-3 w-3 ${run.status === "RUNNING" ? "animate-spin" : ""}`} />
          {status.label}
        </Pill>
      </div>

      <p className="mt-3 break-words text-sm text-zinc-100">{run.instruction}</p>
      {run.summary && <p className="mt-2 text-sm text-zinc-400">{run.summary}</p>}
      {run.error && <p className="mt-2 font-mono text-xs text-rose-400">{run.error}</p>}

      {(run.action_type || run.thought) && (
        <button
          onClick={() => setOpen(!open)}
          className="mt-3 flex items-center gap-1 font-mono text-[11px] text-zinc-500 hover:text-zinc-300"
        >
          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          {run.action_type && run.action_type !== "NONE" ? `Action: ${run.action_type}` : "Details"}
        </button>
      )}
      {open && (
        <div className="mt-2 space-y-2">
          {run.thought && <p className="text-xs italic text-zinc-400">{run.thought}</p>}
          {run.action_payload && (
            <pre className="max-h-64 overflow-auto rounded-lg border border-zinc-800 bg-black/50 p-3 font-mono text-[11px] text-zinc-300">
              {JSON.stringify(run.action_payload, null, 2)}
            </pre>
          )}
          {run.verification && (
            <p className="text-xs text-zinc-400">
              <span className="mr-2 rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-[10px] uppercase text-zinc-400">Verifier</span>
              {run.verification.feedback}
            </p>
          )}
          {run.result && (
            <pre className="overflow-auto rounded-lg border border-zinc-800 bg-black/50 p-3 font-mono text-[11px] text-zinc-400">
              {JSON.stringify(run.result, null, 2)}
            </pre>
          )}
        </div>
      )}
    </article>
  );
}
