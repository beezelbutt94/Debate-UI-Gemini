export type RunStatus =
  | "QUEUED"
  | "RUNNING"
  | "COMPLETED"
  | "APPROVAL_REQUIRED"
  | "EXECUTED"
  | "REJECTED"
  | "BLOCKED"
  | "FAILED";

export interface AgentRun {
  id: string;
  agent: string;
  instruction: string;
  trigger: string;
  status: RunStatus;
  thought: string | null;
  summary: string | null;
  action_type: string | null;
  action_payload: Record<string, unknown> | null;
  verification: { approved: boolean; feedback: string } | null;
  result: Record<string, unknown> | null;
  error: string | null;
  cost_usd: number;
  created_at: string | null;
  finished_at: string | null;
}

export interface AgentInfo {
  name: string;
  role: string;
  actions: Record<string, "approval" | "auto">;
}

export interface Approval {
  id: string;
  run_id: string | null;
  agent: string;
  action_type: string;
  payload: Record<string, unknown>;
  reason: string | null;
  status: string;
  created_at: string | null;
}

export interface SpendReport {
  day: string;
  total_usd: number;
  global_cap_usd: number;
  agents: { agent: string; cost_usd: number; tokens: number; calls: number; cap_usd: number; locked: boolean }[];
}

export interface Briefing {
  id: string;
  okr_focus: string;
  summary: string;
  delegated_tasks: { agent: string; instruction: string }[];
  created_at: string;
}

export interface Incident {
  id: string;
  title: string;
  status: string;
  commit_sha: string | null;
  revert_pr_url: string | null;
  created_at: string | null;
}

export interface CampaignHealth {
  campaign: string;
  sent: number;
  bounced: number;
  bounce_rate: number;
  threshold: number;
  paused: boolean;
  pause_reason: string | null;
}

export interface AdRecommendation {
  campaign_id: string;
  name: string;
  p_best: number;
  share: number;
  daily_budget_usd: number;
  expected_roas: number;
  roas_90ci: [number, number];
  current_budget_usd: number;
}

export interface Intel {
  id: string;
  competitor: string;
  threat_level: "LOW" | "MEDIUM" | "HIGH";
  headline: string;
  summary: string;
  created_at: string | null;
}

export interface Demo {
  id: string;
  company: string;
  email: string;
  start_time: string;
  meeting_url: string | null;
  briefing_id: string | null;
}

export interface Health {
  llm_mode: "simulated" | "claude_code";
  sandbox_mode: boolean;
  broker: "redis" | "inline";
}

export interface FeedEvent {
  event: string;
  ts?: string;
  run?: AgentRun;
  [key: string]: unknown;
}
