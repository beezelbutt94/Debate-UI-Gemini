import { randomUUID } from 'node:crypto';
import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { retrieveCreatorVoice, recordScriptStyle } from '@/lib/mem0';
import { generateScript } from '@/lib/anthropic';
import type { Platform, ScriptRow } from '@/lib/types';

const VALID_PLATFORMS: Platform[] = ['tiktok', 'youtube_shorts', 'facebook_reels'];

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  let body: { prompt?: unknown; targetPlatform?: unknown; tone?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  if (typeof body.prompt !== 'string' || body.prompt.trim().length === 0) {
    return NextResponse.json({ error: '"prompt" is required.' }, { status: 400 });
  }
  const prompt = body.prompt.trim();

  let targetPlatform: Platform | null = null;
  if (typeof body.targetPlatform === 'string' && body.targetPlatform.length > 0) {
    if (!VALID_PLATFORMS.includes(body.targetPlatform as Platform)) {
      return NextResponse.json(
        { error: `"targetPlatform" must be one of ${VALID_PLATFORMS.join(', ')}.` },
        { status: 400 }
      );
    }
    targetPlatform = body.targetPlatform as Platform;
  }

  const tone = typeof body.tone === 'string' && body.tone.trim().length > 0 ? body.tone.trim() : null;
  const toneParameters = tone ? { tone } : {};

  const admin = createSupabaseAdminClient();

  const { data: quotaOk, error: quotaError } = await admin.rpc('consume_analysis_quota', {
    p_user_id: userId,
  });
  if (quotaError) {
    console.error('consume_analysis_quota failed', quotaError);
    return NextResponse.json({ error: 'Could not check your analysis quota.' }, { status: 500 });
  }
  if (!quotaOk) {
    return NextResponse.json(
      { error: 'Monthly analysis quota exceeded. Upgrade your plan for more analyses.' },
      { status: 402 }
    );
  }

  try {
    // Ensure a creators_profiles row (and a stable Mem0 scope key) exists
    // before touching Mem0 -- this route doesn't collect niche/handles
    // itself, so it only creates the row if Deep-Dive never did.
    const { data: existingProfile } = await admin
      .from('creators_profiles')
      .select('id, mem0_agent_key')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    let profileId: string;
    let mem0AgentKey: string;

    if (existingProfile) {
      profileId = existingProfile.id;
      mem0AgentKey = existingProfile.mem0_agent_key ?? `viral-trending-${userId}-${randomUUID().slice(0, 8)}`;
      if (!existingProfile.mem0_agent_key) {
        await admin.from('creators_profiles').update({ mem0_agent_key: mem0AgentKey }).eq('id', profileId);
      }
    } else {
      mem0AgentKey = `viral-trending-${userId}-${randomUUID().slice(0, 8)}`;
      const { data: inserted, error: insertProfileError } = await admin
        .from('creators_profiles')
        .insert({ user_id: userId, mem0_agent_key: mem0AgentKey })
        .select('id')
        .single();
      if (insertProfileError || !inserted) {
        throw new Error(`Could not save creator profile: ${insertProfileError?.message}`);
      }
      profileId = inserted.id;
    }

    const voice = await retrieveCreatorVoice(mem0AgentKey, prompt);

    const result = await generateScript({
      prompt,
      targetPlatform,
      toneParameters,
      creatorMemories: voice.memories,
    });

    const memoryWrite = await recordScriptStyle(
      mem0AgentKey,
      `For the prompt "${prompt}", this creator's script used hook "${result.storyboard.spoken_hook}" ` +
        `and CTA "${result.storyboard.cta}"${tone ? `, in a ${tone} tone` : ''}.`
    );

    const { data: script, error: insertError } = await admin
      .from('scripts')
      .insert({
        user_id: userId,
        creator_profile_id: profileId,
        title: result.title,
        source_prompt: prompt,
        storyboard: result.storyboard,
        tone_parameters: toneParameters,
        target_platform: targetPlatform,
      })
      .select()
      .single();

    if (insertError || !script) {
      console.error('scripts insert failed', insertError);
      await admin.rpc('refund_analysis_quota', { p_user_id: userId });
      return NextResponse.json({ error: 'Could not save the generated script.' }, { status: 500 });
    }

    return NextResponse.json(
      {
        script: script as ScriptRow,
        memory: { retrieved: voice.available, recorded: memoryWrite.recorded },
      },
      { status: 200 }
    );
  } catch (err) {
    await admin.rpc('refund_analysis_quota', { p_user_id: userId });
    console.error('generate/script failed', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Script generation failed.' },
      { status: 502 }
    );
  }
}
