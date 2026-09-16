import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Platform, ScheduledPostRow } from '@/lib/types';

const VALID_PLATFORMS: Platform[] = ['tiktok', 'youtube_shorts', 'facebook_reels'];

// Plain CRUD, not quota-gated -- creating/listing a calendar entry doesn't
// analyze new external content or call an LLM (that's /api/schedule/generate).

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('scheduled_posts')
    .select('*')
    .eq('user_id', userId)
    .order('publish_at', { ascending: true });

  if (error) {
    console.error('schedule list failed', error);
    return NextResponse.json({ error: 'Could not load scheduled posts.' }, { status: 500 });
  }

  return NextResponse.json({ posts: (data ?? []) as ScheduledPostRow[] }, { status: 200 });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  let body: { platform?: unknown; publishAt?: unknown; caption?: unknown; mediaUrls?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  if (typeof body.platform !== 'string' || !VALID_PLATFORMS.includes(body.platform as Platform)) {
    return NextResponse.json({ error: `"platform" must be one of ${VALID_PLATFORMS.join(', ')}.` }, { status: 400 });
  }
  if (typeof body.publishAt !== 'string' || Number.isNaN(Date.parse(body.publishAt))) {
    return NextResponse.json({ error: '"publishAt" must be a valid ISO date string.' }, { status: 400 });
  }

  const caption = typeof body.caption === 'string' ? body.caption : null;
  const mediaUrls = Array.isArray(body.mediaUrls) ? body.mediaUrls.filter((u) => typeof u === 'string') : [];

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('scheduled_posts')
    .insert({
      user_id: userId,
      platform: body.platform,
      publish_at: new Date(body.publishAt).toISOString(),
      caption,
      media_urls: mediaUrls,
      status: 'draft',
    })
    .select()
    .single();

  if (error || !data) {
    console.error('schedule create failed', error);
    return NextResponse.json({ error: 'Could not create the scheduled post.' }, { status: 500 });
  }

  return NextResponse.json({ post: data as ScheduledPostRow }, { status: 201 });
}
