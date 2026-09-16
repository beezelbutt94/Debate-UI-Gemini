export interface UserRow {
  id: string;
  stripe_customer_id: string | null;
  plan: 'none' | 'starter' | 'pro' | 'agency';
  active_credits: number;
}

export interface PlatformConnection {
  platform: 'tiktok' | 'google';
  external_account_id: string | null;
}

/**
 * A publish job. Still backed by the `campaign_logs` table -- the schema is
 * unchanged from the paid-ads era, only the meaning of the columns moved:
 * `pasted_url` is the source video, `platform` is where it is published,
 * `credits_charged` is the cost of the work rather than an ad budget, and
 * `external_campaign_id` holds the platform's post id.
 */
export interface CampaignLog {
  id: number;
  pasted_url: string;
  platform: 'tiktok' | 'youtube';
  credits_charged: number;
  /** `active` is a leftover of the ad model; publishes go pending -> completed. */
  status: 'pending' | 'active' | 'failed' | 'completed';
  external_campaign_id: string | null;
  created_at: string;
}
