import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { publishToYouTube } from '@/lib/publish/youtube';
import { publishToTikTok } from '@/lib/publish/tiktok';
import { publishToFacebook } from '@/lib/publish/facebook';
import type { Platform, ScheduledPostRow } from '@/lib/types';

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
  const { data: due, error } = await admin
    .from('scheduled_posts')
    .select('*')
    .eq('status', 'scheduled')
    .lte('publish_at', new Date().toISOString());

  if (error) {
    console.error('cron publish: could not load due posts', error);
    return NextResponse.json({ error: 'Could not load due posts.' }, { status: 500 });
  }

  const results: { id: string; ok: boolean; detail: string }[] = [];

  for (const post of (due ?? []) as ScheduledPostRow[]) {
    try {
      if (post.media_urls.length === 0) {
        throw new Error('No media attached to this scheduled post.');
      }
      const publisher = PUBLISHERS[post.platform];
      const { externalPostId } = await publisher(post.user_id, post);

      await admin
        .from('scheduled_posts')
        .update({ status: 'published', publish_error: null })
        .eq('id', post.id);

      results.push({ id: post.id, ok: true, detail: externalPostId });
    } catch (err) {
      const message = (err as Error).message;
      console.error(`cron publish: post ${post.id} failed`, message);

      await admin
        .from('scheduled_posts')
        .update({ status: 'failed', publish_error: message })
        .eq('id', post.id);

      results.push({ id: post.id, ok: false, detail: message });
    }
  }

  return NextResponse.json({ processed: results.length, results }, { status: 200 });
}
