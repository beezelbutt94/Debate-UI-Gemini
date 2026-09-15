import { createSupabaseAdminClient } from './supabase/admin';

/**
 * Compliant distribution gateway.
 *
 * ViralSync never simulates engagement (no bots, no click farms). This
 * module is the only place allowed to talk to a platform's official ad
 * API, and it only ever allocates a *creator's own, OAuth-authorized* ad
 * account budget (see lib/oauth/) to amplify their content through that
 * platform's own ad auction.
 *
 * Both clients below stop short of actually placing an ad: doing that
 * safely needs live testing against a real, approved developer app, which
 * doesn't exist yet. What *is* real: the connection lookup (a creator must
 * have completed OAuth before we'll even attempt a spend) and the
 * required-env-var checks. Calling amplify() throws until both are in
 * place, so the gateway fails loudly instead of pretending to work.
 */

export type Platform = 'tiktok' | 'youtube';

export interface AmplificationRequest {
  userId: string;
  platform: Platform;
  contentUrl: string;
  budgetMicros: number; // smallest currency unit the platform API expects
}

export interface AmplificationResult {
  externalCampaignId: string;
  status: 'active' | 'pending_review';
}

export interface DistributionClient {
  amplify(req: AmplificationRequest): Promise<AmplificationResult>;
}

/** Looks up the creator's stored OAuth credential via the Vault-backed RPC. */
async function getConnectionToken(userId: string, platform: 'tiktok' | 'google'): Promise<string> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc('get_platform_refresh_token', {
    p_user_id: userId,
    p_platform: platform,
  });
  if (error || !data) {
    throw new Error(
      `${platform}_not_connected: this creator hasn't authorized their ${platform} ad account yet. ` +
        `Send them to /api/oauth/${platform}/start first.`
    );
  }
  return data as string;
}

class TikTokSparkAdsClient implements DistributionClient {
  async amplify(req: AmplificationRequest): Promise<AmplificationResult> {
    if (!process.env.TIKTOK_CLIENT_ID || !process.env.TIKTOK_CLIENT_SECRET) {
      throw new Error(
        'TikTok Spark Ads is not configured. Register a TikTok for Business app, set ' +
          'TIKTOK_CLIENT_ID/TIKTOK_CLIENT_SECRET, and complete app review before enabling live campaigns.'
      );
    }

    // Confirms the creator completed OAuth (lib/oauth/tiktok.ts) before we
    // touch their ad account at all.
    await getConnectionToken(req.userId, 'tiktok');

    // TODO: with the access token above, call TikTok Marketing API's
    // spark_ads / campaign create endpoints, scoped to the advertiser_id
    // captured during OAuth (platform_connections.external_account_id),
    // using req.contentUrl and req.budgetMicros.
    throw new Error('TikTok Spark Ads campaign creation not yet implemented.');
  }
}

class GoogleAdsClient implements DistributionClient {
  async amplify(req: AmplificationRequest): Promise<AmplificationResult> {
    if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN || !process.env.GOOGLE_ADS_CLIENT_ID) {
      throw new Error(
        'Google Ads is not configured. Complete Google Ads API developer token approval, ' +
          'register an OAuth client, and set GOOGLE_ADS_DEVELOPER_TOKEN/GOOGLE_ADS_CLIENT_ID/' +
          'GOOGLE_ADS_CLIENT_SECRET before enabling live campaigns.'
      );
    }

    // Confirms the creator completed OAuth (lib/oauth/google.ts) before we
    // touch their Ads account at all.
    await getConnectionToken(req.userId, 'google');

    // TODO: exchange the refresh token above for a short-lived access
    // token, then call Google Ads API's campaign/ad-group/ad mutate
    // endpoints against the customer_id captured during OAuth, using
    // req.contentUrl and req.budgetMicros.
    throw new Error('Google Ads campaign creation not yet implemented.');
  }
}

const clients: Record<Platform, DistributionClient> = {
  tiktok: new TikTokSparkAdsClient(),
  youtube: new GoogleAdsClient(),
};

export function detectPlatform(url: string): Platform {
  const host = new URL(url).hostname.replace(/^www\./, '');
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return 'tiktok';
  if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be') {
    return 'youtube';
  }
  throw new Error('Unsupported URL: only TikTok and YouTube links are accepted.');
}

export function getDistributionClient(platform: Platform): DistributionClient {
  return clients[platform];
}
