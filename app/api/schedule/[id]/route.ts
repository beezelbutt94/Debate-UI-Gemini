import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { logEvent } from '@/lib/events';
import { EDITABLE_STATUSES, parsePostFields, readinessError } from '@/lib/schedule';
import type { ScheduledPostRow } from '@/lib/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Scheduled post not found.' }, { status: 404 });
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

  const parsed = parsePostFields(body, userId, true);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }
  const patch: Record<string, unknown> = { ...parsed.fields };
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  // Scoped by both id and user_id so one user can never read or change
  // another user's calendar entry.
  const { data: current } = await admin
    .from('scheduled_posts')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (!current) {
    return NextResponse.json({ error: 'Scheduled post not found.' }, { status: 404 });
  }
  const post = current as ScheduledPostRow;
  if (!EDITABLE_STATUSES.includes(post.status)) {
    return NextResponse.json(
      { error: post.status === 'published' ? 'This post has already been published.' : 'This post is publishing right now.' },
      { status: 409 }
    );
  }

  const next = { ...post, ...patch } as ScheduledPostRow;
  // Any edit to a failed post puts it back to draft unless it is being
  // re-scheduled, and clears the old failure message.
  if (post.status === 'failed' && patch.status === undefined) patch.status = 'draft';
  if (patch.status !== undefined) patch.publish_error = null;

  if ((patch.status ?? post.status) === 'scheduled') {
    const notReady = await readinessError(admin, userId, next);
    if (notReady) return NextResponse.json({ error: notReady }, { status: 409 });
  }

  // The status guard in the WHERE clause makes this safe against the cron
  // publisher claiming the post between the read above and this write.
  const { data, error } = await admin
    .from('scheduled_posts')
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)
    .in('status', EDITABLE_STATUSES)
    .select()
    .maybeSingle();

  if (error) {
    await logEvent('error', 'schedule.update_failed', { userId, detail: { code: error.code } });
    return NextResponse.json({ error: 'Could not save your changes. Please try again.' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'This post started publishing and can no longer be edited.' }, { status: 409 });
  }

  return NextResponse.json({ post: data as ScheduledPostRow }, { status: 200 });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }
  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Scheduled post not found.' }, { status: 404 });
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('scheduled_posts')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
    .neq('status', 'publishing')
    .select('id')
    .maybeSingle();

  if (error) {
    await logEvent('error', 'schedule.delete_failed', { userId, detail: { code: error.code } });
    return NextResponse.json({ error: 'Could not delete the post. Please try again.' }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Post not found, or it is publishing right now.' }, { status: 404 });
  }

  return NextResponse.json({ deleted: true }, { status: 200 });
}
