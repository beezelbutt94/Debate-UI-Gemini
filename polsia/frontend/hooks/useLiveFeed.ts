"use client";

import { useEffect, useState } from "react";
import { api, wsUrl } from "@/lib/api";
import type { AgentRun, FeedEvent } from "@/lib/types";

export interface Alert {
  id: string;
  tone: "info" | "warn" | "danger";
  text: string;
}

const MAX_RUNS = 100;

function upsert(runs: AgentRun[], run: AgentRun): AgentRun[] {
  const rest = runs.filter((r) => r.id !== run.id);
  return [run, ...rest]
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))
    .slice(0, MAX_RUNS);
}

function toAlert(e: FeedEvent): Alert | null {
  const id = `${e.event}-${e.ts ?? Math.random()}`;
  switch (e.event) {
    case "DELIVERABILITY_ALERT":
      return { id, tone: "danger", text: `Campaign "${e.campaign}" paused: ${e.reason}` };
    case "INCIDENT": {
      const incident = e.incident as { title: string; status: string };
      return { id, tone: "danger", text: `Incident: ${incident.title} (${incident.status.replaceAll("_", " ").toLowerCase()})` };
    }
    case "CANARY_RESOLVED": {
      const canary = e.canary as { status: string; commit_sha: string; failure_reason: string | null };
      return canary.status === "FAILED"
        ? { id, tone: "danger", text: `Canary failed for ${canary.commit_sha.slice(0, 8)}: ${canary.failure_reason}` }
        : { id, tone: "info", text: `Canary passed for ${canary.commit_sha.slice(0, 8)}` };
    }
    case "DEMO_BOOKED":
      return { id, tone: "info", text: `Demo booked: ${e.company} (${e.email})` };
    case "MARKET_INTEL": {
      const intel = e.intel as { competitor: string; threat_level: string; headline: string };
      return intel.threat_level === "LOW" ? null : { id, tone: "warn", text: `${intel.competitor}: ${intel.headline}` };
    }
    default:
      return null;
  }
}

/**
 * Streams the swarm's live events. `version` increments on every real event so
 * panels can refetch their slice of state without each opening a socket.
 */
export function useLiveFeed() {
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [connected, setConnected] = useState(false);
  const [version, setVersion] = useState(0);
  const [alerts, setAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    let closed = false;
    let socket: WebSocket | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let backoff = 1000;

    const catchUp = () =>
      api<AgentRun[]>("/runs?limit=50")
        .then((list) => !closed && setRuns((prev) => list.reduce(upsert, prev)))
        .catch(() => undefined);

    const connect = () => {
      socket = new WebSocket(wsUrl());
      socket.onopen = () => {
        backoff = 1000;
        setConnected(true);
        setVersion((v) => v + 1);
        catchUp();
      };
      socket.onmessage = (msg) => {
        let data: FeedEvent;
        try {
          data = JSON.parse(msg.data);
        } catch {
          return;
        }
        if (data.event === "PING" || data.event === "CONNECTED") return;
        if (data.run) setRuns((prev) => upsert(prev, data.run as AgentRun));
        const alert = toAlert(data);
        if (alert) setAlerts((prev) => [alert, ...prev].slice(0, 5));
        setVersion((v) => v + 1);
      };
      socket.onclose = () => {
        setConnected(false);
        if (closed) return;
        retry = setTimeout(connect, backoff);
        backoff = Math.min(backoff * 1.5, 10_000);
      };
      socket.onerror = () => socket?.close();
    };

    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      socket?.close();
    };
  }, []);

  const dismiss = (id: string) => setAlerts((prev) => prev.filter((a) => a.id !== id));
  return { runs, connected, version, alerts, dismiss };
}

/** Fetch `path` now and again whenever `version` changes. */
export function useResource<T>(path: string, version: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stale = false;
    api<T>(path).then(
      (value) => {
        if (stale) return;
        setData(value);
        setError(null);
      },
      (err: Error) => !stale && setError(err.message),
    );
    return () => {
      stale = true;
    };
  }, [path, version]);

  return { data, error };
}
