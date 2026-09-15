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
 * required-env-var checks. Both run in preflight(), which the campaigns
 * route calls *before* charging credits — so an unplaceable campaign is
 * rejected with a specific reason rather than quietly billed for.
 */

export type Platform = 'tiktok' | 'youtube';

/**
 * Why an amplification could not be placed.
 *
 * - `not_configured` — this deployment is missing the platform's API
 *   credentials. Nobody's campaign can succeed until an operator fixes it.
 * - `not_connected` — the deployment is fine; *this creator* hasn't
 *   authorized their ad account yet. They can fix it themselves.
 * - `not_implemented` — the code path genuinely isn't written yet.
 * - `upstream_error` — the ad platform accepted the request and rejected
 *   or failed it.
 *
 * The call site maps these to different HTTP statuses and different
 * user-facing text, which is why they're a discriminated code rather than
 * a message the caller has to pattern-match on.
 */
export type DistributionFailureCode =
  | 'not_configured'
  | 'not_connected'
  | 'not_implemented'
  | 'upstream_error';

export class DistributionError extends Error {
  readonly code: DistributionFailureCode;
  readonly platform: Platform;
  /** What the operator or creator should actually do about it. */
  readonly remedy: string;

  constructor(args: {
    code: DistributionFailureCode;
    platform: Platform;
    message: string;
    remedy: string;
  }) {
    super(args.message);
    this.name = 'DistributionError';
    this.code = args.code;
    this.platform = args.platform;
    this.remedy = args.remedy;
  }
}

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
  /**
   * Everything that can be checked before spending anything: deployment
   * credentials, the creator's OAuth connection, and whether this code path
   * exists at all. Throws `DistributionError` if the campaign cannot be
   * placed; resolves silently if it can.
   *
   * This exists so the caller can charge credits *after* establishing the
   * spend is possible. Charging first and refunding on failure works, but
   * only as a backstop — it briefly takes the creator's balance for a
   * campaign that never had a chance of running.
   *
   * Must have no side effects: it is called on a request that may never
   * proceed.
   */
  preflight(userId: string): Promise<void>;

  amplify(req: AmplificationRequest): Promise<AmplificationResult>;
}

/** Looks up the creator's stored OAuth credential via the Vault-backed RPC. */
async function getConnectionToken(
  userId: string,
  platform: Platform,
  provider: 'tiktok' | 'google'
): Promise<string> {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc('get_platform_refresh_token', {
    p_user_id: userId,
    p_platform: provider,
  });

  // An RPC-level error is an infrastructure problem (bad service-role key,
  // Vault misconfigured, function missing); a null result means the lookup
  // worked and this creator simply has no connection. Reporting the first
  // as the second would send the creator round an OAuth loop that can't fix
  // it, so they stay distinct.
  if (error) {
    throw new DistributionError({
      code: 'not_configured',
      platform,
      message: `Could not read the stored ${provider} credential: ${error.message}`,
      remedy:
        'Check SUPABASE_SERVICE_ROLE_KEY and that get_platform_refresh_token exists ' +
        '(supabase/migrations/0002_platform_connections.sql).',
    });
  }

  if (!data) {
    throw new DistributionError({
      code: 'not_connected',
      platform,
      message: `This creator has not authorized their ${provider} ad account yet.`,
      remedy: `Complete the connection at /api/oauth/${provider}/start, then retry.`,
    });
  }

  return data as string;
}

class TikTokSparkAdsClient implements DistributionClient {
  async preflight(userId: string): Promise<void> {
    if (!process.env.TIKTOK_CLIENT_ID || !process.env.TIKTOK_CLIENT_SECRET) {
      throw new DistributionError({
        code: 'not_configured',
        platform: 'tiktok',
        message: 'TikTok Spark Ads is not configured on this deployment.',
        remedy:
          'Register a TikTok for Business app, set TIKTOK_CLIENT_ID and TIKTOK_CLIENT_SECRET, ' +
          'and complete app review before enabling live campaigns.',
      });
    }

    // Confirms the creator completed OAuth (lib/oauth/tiktok.ts) before we
    // touch their ad account at all.
    await getConnectionToken(userId, 'tiktok', 'tiktok');

    // TODO: remove once amplify() below actually places the campaign.
    throw new DistributionError({
      code: 'not_implemented',
      platform: 'tiktok',
      message: 'TikTok Spark Ads campaign creation is not implemented yet.',
      remedy:
        'Implement TikTokSparkAdsClient.amplify() against the TikTok Marketing API. ' +
        'Until then TikTok campaigns are rejected before any credits are charged.',
    });
  }

  async amplify(req: AmplificationRequest): Promise<AmplificationResult> {
    await this.preflight(req.userId);

    // TODO: with the access token from preflight, call TikTok Marketing
    // API's spark_ads / campaign create endpoints, scoped to the
    // advertiser_id captured during OAuth
    // (platform_connections.external_account_id), using req.contentUrl and
    // req.budgetMicros.
    throw new DistributionError({
      code: 'not_implemented',
      platform: 'tiktok',
      message: 'TikTok Spark Ads campaign creation is not implemented yet.',
      remedy: 'Implement TikTokSparkAdsClient.amplify() against the TikTok Marketing API.',
    });
  }
}

class GoogleAdsClient implements DistributionClient {
  async preflight(userId: string): Promise<void> {
    if (!process.env.GOOGLE_ADS_DEVELOPER_TOKEN || !process.env.GOOGLE_ADS_CLIENT_ID) {
      throw new DistributionError({
        code: 'not_configured',
        platform: 'youtube',
        message: 'Google Ads is not configured on this deployment.',
        remedy:
          'Complete Google Ads API developer token approval, register an OAuth client, and set ' +
          'GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CLIENT_ID and GOOGLE_ADS_CLIENT_SECRET.',
      });
    }

    // Confirms the creator completed OAuth (lib/oauth/google.ts) before we
    // touch their Ads account at all.
    await getConnectionToken(userId, 'youtube', 'google');

    // TODO: remove once amplify() below actually places the campaign.
    throw new DistributionError({
      code: 'not_implemented',
      platform: 'youtube',
      message: 'Google Ads campaign creation is not implemented yet.',
      remedy:
        'Implement GoogleAdsClient.amplify() against the Google Ads API. ' +
        'Until then YouTube campaigns are rejected before any credits are charged.',
    });
  }

  async amplify(req: AmplificationRequest): Promise<AmplificationResult> {
    await this.preflight(req.userId);

    // TODO: exchange the refresh token from preflight for a short-lived
    // access token, then call Google Ads API's campaign/ad-group/ad mutate
    // endpoints against the customer_id captured during OAuth, using
    // req.contentUrl and req.budgetMicros.
    throw new DistributionError({
      code: 'not_implemented',
      platform: 'youtube',
      message: 'Google Ads campaign creation is not implemented yet.',
      remedy: 'Implement GoogleAdsClient.amplify() against the Google Ads API.',
    });
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
