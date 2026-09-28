"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { post } from "@/lib/api";
import type { AgentInfo } from "@/lib/types";
import { Button } from "./ui";

export function DispatchBar({ agents }: { agents: AgentInfo[] }) {
  const [agent, setAgent] = useState("");
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selected = agent || agents[0]?.name || "";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instruction.trim() || !selected) return;
    setBusy(true);
    setError(null);
    try {
      await post("/agents/run", { agent: selected, instruction });
      setInstruction("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={selected}
          onChange={(e) => setAgent(e.target.value)}
          className="rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 outline-none focus:border-zinc-600"
        >
          {agents.map((a) => (
            <option key={a.name} value={a.name} title={a.role}>
              {a.name}
            </option>
          ))}
        </select>
        <input
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          placeholder="Give the agent a directive…"
          className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-zinc-600"
        />
        <Button type="submit" variant="primary" disabled={busy || !instruction.trim()}>
          <Play className="h-3.5 w-3.5" /> Run
        </Button>
      </div>
      {error && <p className="font-mono text-xs text-rose-400">{error}</p>}
    </form>
  );
}
