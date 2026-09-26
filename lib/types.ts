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
  plan_tier: 'free' | 'creator' | 'pro' | 'studio';
  status: string;
  quota_analyses_used: number;
  quota_analyses_limit: number;
  quota_period_start: string;
  cancel_at_period_end: boolean;
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

export interface GrowthBlueprint {
  thematic_consistency: { score: number; notes: string };
  view_to_follower_ratio: { value: number | null; assessment: string };
  posting_cadence: { avg_days_between_posts: number | null; assessment: string };
  theme_correction: string[];
  view_maximization_tactics: string[];
  posting_blindspots: string[];
  per_platform_notes: Record<string, string>;
}

export interface UploadDiagnosis {
  visual_hook_clarity: HookEvaluation;
  audio_balance: { score: number; notes: string };
  text_overlay_pacing: { assessment: string };
  b_roll_recommendations: string[];
  retention_boosters: string[];
  frames_analyzed: number;
}

export interface AuditReportRow<
  TAnalysis = ViralGapAnalysis | GrowthBlueprint | UploadDiagnosis | CompetitorGapAnalysis | SiteDiscoveryResult
> {
  id: string;
  user_id: string;
  creator_profile_id: string | null;
  source_type: 'url' | 'account' | 'upload' | 'competitors' | 'discovery';
  source_url: string | null;
  platform: Platform | null;
  viral_score: number | null;
  analysis: TAnalysis;
  timeline_recommendations: TimelineRecommendation[];
  created_at: string;
}

export interface CreatorHandles {
  youtube?: string;
  tiktok?: string;
  instagram?: string;
}

// The account-handle family (youtube/tiktok/instagram) is distinct from
// `Platform` above, which names short-form *content* types
// (tiktok/youtube_shorts/facebook_reels) for a single video/report.
export type AccountPlatform = keyof CreatorHandles;

export interface CreatorProfileRow {
  id: string;
  user_id: string;
  niche: string | null;
  handles: CreatorHandles;
  connected_metrics: Record<string, unknown>;
  mem0_agent_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface ScriptScene {
  scene_number: number;
  visual_action: string;
  dialogue_or_vo: string;
  audio_sfx_cue: string;
  retention_loop_note: string;
}

export interface Storyboard {
  spoken_hook: string; // <3s -- the opening line, scene 1's dialogue
  scenes: ScriptScene[];
  cta: string;
  memory_context_used: boolean; // whether prior Mem0 creator-voice memories informed this script
}

export type SuiteTool = 'descript' | 'opusclip' | 'hyperframes' | 'canva';

export interface ToolRecommendation {
  tool: SuiteTool;
  label: string;
  url: string;
  reason: string; // grounded in a specific real finding, not generic advice
  action: string; // what to actually do once there
  source: string; // which past report/script this is grounded in, e.g. "Upload Diagnostic, Sep 12"
}

export interface ScriptRow {
  id: string;
  user_id: string;
  creator_profile_id: string | null;
  title: string;
  source_prompt: string | null;
  storyboard: Storyboard;
  tone_parameters: Record<string, unknown>;
  target_platform: Platform | null;
  created_at: string;
}

export interface CompetitorHandle {
  platform: AccountPlatform;
  handle: string;
}

export interface CompetitorSnapshot {
  handle: string;
  platform: AccountPlatform;
  summary: string; // what was actually found for this competitor
  fetch_error: string | null; // non-null if this one competitor's fetch failed
}

export interface CompetitorGapAnalysis {
  competitors: CompetitorSnapshot[];
  outlier_topics: string[]; // top-performing themes competitors use
  missing_topics: string[]; // topics competitors cover that this creator doesn't
  audience_sentiment_gaps: string[];
  untapped_keyword_clusters: string[]; // grounded in real Tavily search results
}

export interface DiscoveredSite {
  url: string;
  domain: string;
  title: string;
  snippet: string; // taken from the real search result, not invented
  relevance_reason: string; // why this made the top 10 for the query
}

export interface SiteDiscoveryResult {
  query: string;
  sites: DiscoveredSite[]; // ranked, best match first -- exactly 10 when enough candidates exist
  outlier: {
    url: string; // must be one of sites[].url
    reasoning: string; // concretely how/why this one differs from the other 9
  };
  summary: string;
}

export interface ScheduledPostRow {
  id: string;
  user_id: string;
  platform: Platform;
  publish_at: string;
  media_urls: string[];
  caption: string | null;
  status: 'draft' | 'scheduled' | 'publishing' | 'published' | 'failed';
  publish_error: string | null;
  external_post_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarSlot {
  day_of_week: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  time_local: string; // "HH:MM", 24h
  platform: Platform;
  topic_suggestion: string;
  reasoning: string; // grounded in real search results / this creator's own cadence data
}

export type ConnectablePlatform = 'youtube' | 'tiktok' | 'facebook' | 'canva';

// Never includes the underlying token -- those stay in Supabase Vault,
// reachable only via the service-role get_platform_connection_secrets() RPC.
export interface PlatformConnectionSummary {
  platform: ConnectablePlatform;
  external_account_label: string | null;
  connected_at: string;
}
