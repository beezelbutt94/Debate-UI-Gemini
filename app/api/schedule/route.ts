import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logEvent } from '@/lib/events';
import { ensureAccount } from '@/lib/account';
import { parsePostFields, readinessError } from '@/lib/schedule';
import type { ScheduledPostRow } from '@/lib/types';

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
    .order('publish_at', { ascending: true })
    .limit(200);

  if (error) {
    await logEvent('error', 'schedule.list_failed', { userId, detail: { code: error.code } });
    return NextResponse.json({ error: 'Could not load your calendar. Please refresh.' }, { status: 500 });
  }

  return NextResponse.json({ posts: (data ?? []) as ScheduledPostRow[] }, { status: 200 });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Request body must be a JSON object.' }, { status: 400 });
  }

  const parsed = parsePostFields(body, userId, false);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const { fields } = parsed;
  const status = fields.status ?? 'draft';
  const mediaUrls = fields.media_urls ?? [];

  const admin = createSupabaseAdminClient();

  if (status === 'scheduled') {
    const notReady = await readinessError(admin, userId, { platform: fields.platform!, media_urls: mediaUrls });
    if (notReady) return NextResponse.json({ error: notReady }, { status: 409 });
  }

  // scheduled_posts.user_id references users(id); make sure it exists.
  await ensureAccount(userId);

  const { data, error } = await admin
    .from('scheduled_posts')
    .insert({
      user_id: userId,
      platform: fields.platform,
      publish_at: fields.publish_at,
      caption: fields.caption ?? null,
      media_urls: mediaUrls,
      status,
    })
    .select()
    .single();

  if (error || !data) {
    await logEvent('error', 'schedule.create_failed', { userId, detail: { code: error?.code } });
    return NextResponse.json({ error: 'Could not save the post. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ post: data as ScheduledPostRow }, { status: 201 });
}
