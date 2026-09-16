export type Platform = 'tiktok' | 'youtube_shorts' | 'facebook_reels';

export interface UserRow {
  id: string; // Clerk user id
  email: string;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionRow {
  id: string;
  user_id: string;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  plan_tier: 'creator' | 'pro' | 'studio';
  status: string;
  quota_analyses_used: number;
  quota_analyses_limit: number;
  current_period_end: string | null;
}

export interface HookEvaluation {
  score: number; // 0-100
  verdict: 'strong' | 'moderate' | 'weak';
  notes: string;
}

export interface RetentionPrediction {
  at_3s_percent: number;
  at_30s_percent: number;
  meets_3s_benchmark: boolean; // >= 60%
  meets_30s_benchmark: boolean; // >= 40%
}

export interface TimelineRecommendation {
  timestamp_seconds: number;
  issue: string;
  recommendation: string;
  severity: 'critical' | 'moderate' | 'minor';
}

export interface PacingAudit {
  cuts_per_10s: number | null;
  assessment: string;
}

export interface ViralGapAnalysis {
  pacing_audit: PacingAudit;
  hook_evaluation: HookEvaluation;
  retention_prediction: RetentionPrediction;
  action_plan: string[];
  source_metrics: Record<string, unknown>;
}

export interface AuditReportRow {
  id: string;
  user_id: string;
  creator_profile_id: string | null;
  source_type: 'url' | 'account' | 'upload';
  source_url: string | null;
  platform: Platform | null;
  viral_score: number | null;
  analysis: ViralGapAnalysis;
  timeline_recommendations: TimelineRecommendation[];
  created_at: string;
}
