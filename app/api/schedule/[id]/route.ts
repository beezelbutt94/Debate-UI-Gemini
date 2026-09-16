import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import type { Platform, ScheduledPostRow } from '@/lib/types';

const VALID_PLATFORMS: Platform[] = ['tiktok', 'youtube_shorts', 'facebook_reels'];
const VALID_STATUSES: ScheduledPostRow['status'][] = ['draft', 'scheduled', 'published', 'failed'];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }
  const { id } = await params;

  let body: { publishAt?: unknown; platform?: unknown; caption?: unknown; status?: unknown; mediaUrls?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};

  if (body.publishAt !== undefined) {
    if (typeof body.publishAt !== 'string' || Number.isNaN(Date.parse(body.publishAt))) {
      return NextResponse.json({ error: '"publishAt" must be a valid ISO date string.' }, { status: 400 });
    }
    patch.publish_at = new Date(body.publishAt).toISOString();
  }
  if (body.platform !== undefined) {
    if (typeof body.platform !== 'string' || !VALID_PLATFORMS.includes(body.platform as Platform)) {
      return NextResponse.json({ error: `"platform" must be one of ${VALID_PLATFORMS.join(', ')}.` }, { status: 400 });
    }
    patch.platform = body.platform;
  }
  if (body.status !== undefined) {
    if (typeof body.status !== 'string' || !VALID_STATUSES.includes(body.status as ScheduledPostRow['status'])) {
      return NextResponse.json({ error: `"status" must be one of ${VALID_STATUSES.join(', ')}.` }, { status: 400 });
    }
    patch.status = body.status;
  }
  if (body.caption !== undefined) {
    patch.caption = typeof body.caption === 'string' ? body.caption : null;
  }
  if (body.mediaUrls !== undefined) {
    patch.media_urls = Array.isArray(body.mediaUrls) ? body.mediaUrls.filter((u) => typeof u === 'string') : [];
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update.' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  // Scoped by both id and user_id so one user can never reschedule or
  // delete another user's calendar entry.
  const { data, error } = await admin
    .from('scheduled_posts')
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Scheduled post not found.' }, { status: 404 });
  }

  return NextResponse.json({ post: data as ScheduledPostRow }, { status: 200 });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }
  const { id } = await params;

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('scheduled_posts')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .select('id')
    .single();

  if (error || !data) {
    return NextResponse.json({ error: 'Scheduled post not found.' }, { status: 404 });
  }

  return NextResponse.json({ deleted: true }, { status: 200 });
}
