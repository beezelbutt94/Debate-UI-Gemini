import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { isOAuthPlatform } from '@/lib/oauth';
import type { PlatformConnectionSummary } from '@/lib/types';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const admin = createSupabaseAdminClient();
  // Selects only display fields -- the secret ids never leave the server,
  // and the underlying tokens live in Vault, unreachable from this table.
  const { data, error } = await admin
    .from('platform_connections')
    .select('platform, external_account_label, created_at')
    .eq('user_id', userId);

  if (error) {
    console.error('connections list failed', error);
    return NextResponse.json({ error: 'Could not load connections.' }, { status: 500 });
  }

  const connections: PlatformConnectionSummary[] = (data ?? []).map((row) => ({
    platform: row.platform,
    external_account_label: row.external_account_label,
    connected_at: row.created_at,
  }));

  return NextResponse.json({ connections }, { status: 200 });
}

export async function DELETE(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  const platform = new URL(request.url).searchParams.get('platform');
  if (!platform || !isOAuthPlatform(platform)) {
    return NextResponse.json({ error: `"platform" must be one of youtube, tiktok, facebook, canva.` }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  // Vault-backed function so the disconnect also deletes the encrypted
  // secret(s), not just the connections row.
  const { error } = await admin.rpc('delete_platform_connection', {
    p_user_id: userId,
    p_platform: platform,
  });

  if (error) {
    console.error('connection disconnect failed', error);
    return NextResponse.json({ error: 'Could not disconnect.' }, { status: 500 });
  }

  return NextResponse.json({ disconnected: true }, { status: 200 });
}
