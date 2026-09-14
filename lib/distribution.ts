/**
 * Compliant distribution gateway.
 *
 * ViralSync never simulates engagement (no bots, no click farms). This
 * module is the only place allowed to talk to a platform's official ad
 * API, and it only ever allocates a real advertiser's real micro-budget
 * to amplify a creator's own content to real users through that
 * platform's own ad auction.
 *
 * Both clients below are stubs: wiring them up requires a verified
 * TikTok Business / Google Ads developer app, OAuth credentials for the
 * creator's own ad account, and a funded budget — none of which exist
 * yet. Calling either throws until real credentials are supplied via
 * env vars, so the gateway fails loudly instead of pretending to work.
 */

export type Platform = 'tiktok' | 'youtube';

export interface AmplificationRequest {
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

class TikTokSparkAdsClient implements DistributionClient {
  async amplify(_req: AmplificationRequest): Promise<AmplificationResult> {
    if (!process.env.TIKTOK_API_KEY) {
      throw new Error(
        'TikTok Spark Ads is not configured. Set TIKTOK_API_KEY and complete ' +
          'TikTok Business API app review before enabling live campaigns.'
      );
    }
    // TODO: call TikTok Marketing API `spark_ads` create-campaign endpoint
    // using the creator's own OAuth-authorized advertiser account.
    throw new Error('TikTok Spark Ads integration not yet implemented.');
  }
}

class GoogleAdsClient implements DistributionClient {
  async amplify(_req: AmplificationRequest): Promise<AmplificationResult> {
    if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN) {
      throw new Error(
        'Google Ads is not configured. Set GOOGLE_ADS_DEVELOPER_TOKEN and ' +
          'complete Google Ads API developer token approval before enabling live campaigns.'
      );
    }
    // TODO: call Google Ads API VideoResponsiveAd / campaign mutate
    // using the creator's own OAuth-authorized Ads account.
    throw new Error('Google Ads integration not yet implemented.');
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
