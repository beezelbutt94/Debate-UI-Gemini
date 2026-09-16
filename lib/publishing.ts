import { createSupabaseAdminClient } from './supabase/admin';

/**
 * Organic publishing gateway.
 *
 * Replaces the paid-amplification gateway this app used to have. The old
 * model bought ad inventory on the creator's behalf; this one posts a
 * finished video to the creator's own account through each platform's
 * official Content API. Those APIs are free -- the gate is an app review,
 * not a price tag.
 *
 * What it still never does: simulate engagement. No bot views, likes,
 * follows or comments. That was the compliance line under the ad model and
 * it is the same line here -- it is the reason this posts through official
 * APIs rather than driving a browser.
 *
 * Both clients stop short of actually posting: TikTok's Content Posting
 * API forces every upload to private until an app passes its audit, and
 * YouTube's upload scope needs its own verification. Until those are
 * granted there is nothing honest to implement, so preflight() rejects the
 * request *before* any credits are charged.
 */

export type Platform = 'tiktok' | 'youtube';

/**
 * Why a publish could not happen.
 *
 * - `not_configured` — this deployment has no app credentials for the
 *   platform. Nobody can publish until an operator fixes it.
 * - `not_connected` — the deployment is fine; *this creator* hasn't
 *   authorized their account. They can fix it themselves.
 * - `not_reviewed` — credentials exist but the platform hasn't granted the
 *   permission yet (TikTok audit, YouTube verification). Waiting, not broken.
 * - `not_implemented` — the code path genuinely isn't written yet.
 * - `upstream_error` — the platform accepted the request and rejected it.
 */
export type PublishFailureCode =
  | 'not_configured'
  | 'not_connected'
  | 'not_reviewed'
  | 'not_implemented'
  | 'upstream_error';

export class PublishError extends Error {
  readonly code: PublishFailureCode;
  readonly platform: Platform;
  /** What the operator or creator should actually do about it. */
  readonly remedy: string;

  constructor(args: {
    code: PublishFailureCode;
    platform: Platform;
    message: string;
    remedy: string;
  }) {
    super(args.message);
    this.name = 'PublishError';
    this.code = args.code;
    this.platform = args.platform;
    this.remedy = args.remedy;
  }
}

export interface PublishRequest {
  userId: string;
  platform: Platform;
  /** The rendered video to post. */
  videoUrl: string;
  caption: string;
}

export interface PublishResult {
  /** The platform's own id for the created post. */
  externalPostId: string;
  /** `private` while an app is still pre-audit; `public` once granted. */
  visibility: 'public' | 'private';
}

export interface PublishingClient {
  /**
   * Everything checkable before spending anything: deployment credentials,
   * the creator's connection, and whether the platform has actually granted
   * the publishing permission. Throws `PublishError`; resolves if publishing
   * is possible.
   *
   * Must have no side effects -- it runs on requests that may never proceed.
   */
  preflight(userId: string): Promise<void>;

  publish(req: PublishRequest): Promise<PublishResult>;
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

  // An RPC-level error is infrastructure (bad service-role key, Vault
  // misconfigured); a null result means the lookup worked and this creator
  // simply has no connection. Reporting the first as the second would send
  // them round an OAuth loop that cannot fix it.
  if (error) {
    throw new PublishError({
      code: 'not_configured',
      platform,
      message: `Could not read the stored ${provider} credential: ${error.message}`,
      remedy:
        'Check SUPABASE_SERVICE_ROLE_KEY and that get_platform_refresh_token exists ' +
        '(supabase/migrations/0002_platform_connections.sql).',
    });
  }

  if (!data) {
    throw new PublishError({
      code: 'not_connected',
      platform,
      message: `This creator has not connected their ${provider} account yet.`,
      remedy: `Complete the connection at /api/oauth/${provider}/start, then retry.`,
    });
  }

  return data as string;
}

class TikTokContentClient implements PublishingClient {
  async preflight(userId: string): Promise<void> {
    if (!process.env.TIKTOK_CLIENT_ID || !process.env.TIKTOK_CLIENT_SECRET) {
      throw new PublishError({
        code: 'not_configured',
        platform: 'tiktok',
        message: 'TikTok publishing is not configured on this deployment.',
        remedy:
          'Register a TikTok developer app with the video.publish scope and set ' +
          'TIKTOK_CLIENT_ID and TIKTOK_CLIENT_SECRET.',
      });
    }

    await getConnectionToken(userId, 'tiktok', 'tiktok');

    // TODO: remove once publish() is implemented and the audit has passed.
    throw new PublishError({
      code: 'not_reviewed',
      platform: 'tiktok',
      message: 'TikTok direct posting is not available on this app yet.',
      remedy:
        "Pass TikTok's Content Posting audit to publish publicly. Before that, uploads are " +
        'forced to private and the creator must finish the post in the TikTok app.',
    });
  }

  async publish(req: PublishRequest): Promise<PublishResult> {
    await this.preflight(req.userId);

    // TODO: POST /v2/post/publish/video/init/ with the access token from
    // preflight, then poll /v2/post/publish/status/fetch/ until the upload
    // settles. Pre-audit this can only produce a private draft.
    throw new PublishError({
      code: 'not_implemented',
      platform: 'tiktok',
      message: 'TikTok publishing is not implemented yet.',
      remedy: "Implement TikTokContentClient.publish() against the Content Posting API.",
    });
  }
}

class YouTubeClient implements PublishingClient {
  async preflight(userId: string): Promise<void> {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      throw new PublishError({
        code: 'not_configured',
        platform: 'youtube',
        message: 'YouTube publishing is not configured on this deployment.',
        remedy:
          'Register a Google Cloud OAuth client with the youtube.upload scope and set ' +
          'GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.',
      });
    }

    await getConnectionToken(userId, 'youtube', 'google');

    // TODO: remove once publish() is implemented and the app is verified.
    throw new PublishError({
      code: 'not_reviewed',
      platform: 'youtube',
      message: 'YouTube uploading is not available on this app yet.',
      remedy:
        'Complete Google OAuth verification for the youtube.upload scope. Unverified apps ' +
        'are capped at test users and uploads stay private.',
    });
  }

  async publish(req: PublishRequest): Promise<PublishResult> {
    await this.preflight(req.userId);

    // TODO: resumable upload to
    // https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable
    // with snippet/status metadata built from req.caption.
    throw new PublishError({
      code: 'not_implemented',
      platform: 'youtube',
      message: 'YouTube publishing is not implemented yet.',
      remedy: 'Implement YouTubeClient.publish() against the YouTube Data API.',
    });
  }
}

const clients: Record<Platform, PublishingClient> = {
  tiktok: new TikTokContentClient(),
  youtube: new YouTubeClient(),
};

export function detectPlatform(url: string): Platform {
  const host = new URL(url).hostname.replace(/^www\./, '');
  if (host === 'tiktok.com' || host.endsWith('.tiktok.com')) return 'tiktok';
  if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be') {
    return 'youtube';
  }
  throw new Error('Unsupported URL: only TikTok and YouTube links are accepted.');
}

export function getPublishingClient(platform: Platform): PublishingClient {
  return clients[platform];
}
