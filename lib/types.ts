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

export interface CampaignLog {
  id: number;
  pasted_url: string;
  platform: 'tiktok' | 'youtube';
  credits_charged: number;
  status: 'pending' | 'active' | 'failed' | 'completed';
  external_campaign_id: string | null;
  created_at: string;
}
