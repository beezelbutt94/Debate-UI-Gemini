"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { post, timeAgo } from "@/lib/api";
import type { Approval } from "@/lib/types";
import { Button, Empty, ErrorLine, Panel, Pill } from "./ui";

export function ApprovalQueue({ approvals, error }: { approvals: Approval[] | null; error: string | null }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const resolve = async (id: string, decision: "APPROVE" | "REJECT") => {
    setBusy(id);
    setActionError(null);
    try {
      await post(`/approvals/${id}/resolve`, { decision });
    } catch (err) {
      setActionError((err as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const list = approvals ?? [];
  return (
    <Panel title={`Approvals${list.length ? ` (${list.length})` : ""}`}>
      <ErrorLine error={error ?? actionError} />
      {list.length === 0 ? (
        <Empty>Nothing waiting on a human.</Empty>
      ) : (
        <ul className="space-y-3">
          {list.map((a) => (
            <li key={a.id} className="rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="sky">{a.action_type}</Pill>
                <span className="font-mono text-[11px] text-zinc-500">
                  {a.agent} · {timeAgo(a.created_at)}
                </span>
              </div>
              {a.reason && <p className="mt-2 text-xs text-zinc-300">{a.reason}</p>}
              <pre className="mt-2 max-h-40 overflow-auto rounded border border-zinc-800 bg-black/40 p-2 font-mono text-[11px] text-zinc-400">
                {JSON.stringify(a.payload, null, 2)}
              </pre>
              <div className="mt-2 flex gap-2">
                <Button variant="primary" disabled={busy === a.id} onClick={() => resolve(a.id, "APPROVE")}>
                  <Check className="h-3.5 w-3.5" /> Approve
                </Button>
                <Button variant="danger" disabled={busy === a.id} onClick={() => resolve(a.id, "REJECT")}>
                  <X className="h-3.5 w-3.5" /> Reject
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
