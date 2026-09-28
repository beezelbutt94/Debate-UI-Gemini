import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { publishToYouTube } from '@/lib/publish/youtube';
import { publishToTikTok } from '@/lib/publish/tiktok';
import { publishToFacebook } from '@/lib/publish/facebook';
import type { Platform, ScheduledPostRow } from '@/lib/types';
import { logEvent } from '@/lib/events';
import { UserFacingError } from '@/lib/errors';
import { isOwnedMediaUrl } from '@/lib/media';

// Posts stuck in 'publishing' longer than this are treated as interrupted.
const STALE_PUBLISHING_MS = 15 * 60 * 1000;
// Keeps one run inside maxDuration even when many posts fall due together.
const MAX_POSTS_PER_RUN = 10;

// Video uploads can take a while to stream through; give this route more
// than the default serverless timeout. Vercel Hobby caps this at 60s
// regardless -- publishing real video needs a Pro plan (or higher) project,
// documented in README.md's deployment notes.
export const maxDuration = 300;

/**
 * Deliberately trigger-agnostic: any caller presenting the right bearer
 * secret can invoke this, whether that's Vercel Cron (vercel.json), an
 * external scheduler, or a manual curl during testing. Vercel Cron sends
 * `Authorization: Bearer $CRON_SECRET` automatically when CRON_SECRET is
 * set as a project env var -- https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
 */
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('authorization') === `Bearer ${secret}`;
}

const PUBLISHERS: Record<Platform, (userId: string, post: ScheduledPostRow) => Promise<{ externalPostId: string }>> = {
  youtube_shorts: publishToYouTube,
  tiktok: publishToTikTok,
  facebook_reels: publishToFacebook,
};

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}

async function handle(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();

  // A run that died mid-publish (timeout, deploy) leaves posts in
  // 'publishing'. Retrying automatically could post the video twice, so
  // mark them failed with an explanation and let the owner decide.
  const staleBefore = new Date(Date.now() - STALE_PUBLISHING_MS).toISOString();
  const { error: staleError } = await admin
    .from('scheduled_posts')
    .update({
      status: 'failed',
      publish_error: 'Publishing was interrupted. Check the platform before scheduling this post again.',
    })
    .eq('status', 'publishing')
    .lt('updated_at', staleBefore);
  if (staleError) {
    await logEvent('error', 'cron.publish_stale_reset_failed', { detail: { code: staleError.code } });
  }

  const { data: due, error } = await admin
    .from('scheduled_posts')
    .select('id')
    .eq('status', 'scheduled')
    .lte('publish_at', new Date().toISOString())
    .order('publish_at', { ascending: true })
    .limit(MAX_POSTS_PER_RUN);

  if (error) {
    await logEvent('error', 'cron.publish_load_failed', { detail: { code: error.code } });
    return NextResponse.json({ error: 'Could not load due posts.' }, { status: 500 });
  }

  const results: { id: string; ok: boolean; detail: string }[] = [];

  for (const { id } of due ?? []) {
    // Claim the post atomically. If another run (or the owner editing it)
    // got there first, the status guard matches nothing and we skip it.
    const { data: claimed } = await admin
      .from('scheduled_posts')
      .update({ status: 'publishing' })
      .eq('id', id)
      .eq('status', 'scheduled')
      .select('*')
      .maybeSingle();
    if (!claimed) continue;
    const post = claimed as ScheduledPostRow;

    try {
      if (post.media_urls.length === 0) {
        throw new UserFacingError('No video is attached to this post.');
      }
      // Re-check at publish time: only the owner's own uploads may be
      // fetched, whatever was stored.
      if (!post.media_urls.every((u) => isOwnedMediaUrl(u, process.env.CLOUDINARY_CLOUD_NAME ?? '', post.user_id))) {
        throw new UserFacingError('The attached media is not one of your uploads. Attach the video again.');
      }
      const publisher = PUBLISHERS[post.platform];
      const { externalPostId } = await publisher(post.user_id, post);

      const { error: saveError } = await admin
        .from('scheduled_posts')
        .update({
          status: 'published',
          publish_error: null,
          external_post_id: externalPostId,
          published_at: new Date().toISOString(),
        })
        .eq('id', post.id);
      if (saveError) {
        await logEvent('error', 'cron.publish_record_failed', {
          userId: post.user_id,
          detail: { postId: post.id, code: saveError.code },
        });
      }

      await logEvent('info', 'cron.published', { userId: post.user_id, detail: { postId: post.id, platform: post.platform } });
      results.push({ id: post.id, ok: true, detail: externalPostId });
    } catch (err) {
      // The owner sees this on their calendar. Platform error text is about
      // their own account and helps them fix it; tokens never appear in it.
      const message = (err instanceof Error ? err.message : 'Publishing failed.').slice(0, 500);
      await logEvent('error', 'cron.publish_failed', {
        userId: post.user_id,
        detail: { postId: post.id, platform: post.platform },
        error: err,
      });

      await admin.from('scheduled_posts').update({ status: 'failed', publish_error: message }).eq('id', post.id);

      results.push({ id: post.id, ok: false, detail: message });
    }
  }

  return NextResponse.json({ processed: results.length, results }, { status: 200 });
}
