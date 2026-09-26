import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { consumeQuotaOrRespond, refundQuota } from '@/lib/quota';
import { logEvent } from '@/lib/events';
import { errorStatus, publicErrorMessage } from '@/lib/errors';
import {
  fetchVideoResource,
  buildFrameUrl,
  buildWaveformUrl,
  pickFrameTimestamps,
} from '@/lib/cloudinary';
import { generateUploadDiagnosis } from '@/lib/anthropic';
import type { AuditReportRow, UploadDiagnosis } from '@/lib/types';

/**
 * Cloudinary's delivery host. Derived URLs are built by interpolating a
 * caller-supplied publicId into a template, so the finished URL is checked
 * against this before it is fetched.
 */
const CLOUDINARY_DELIVERY_HOST = 'res.cloudinary.com';

async function fetchImageAsBase64(url: string): Promise<{ base64: string; mediaType: string } | null> {
  // Server-side request forgery guard. `publicId` reaches buildFrameUrl /
  // buildWaveformUrl as a path segment, and a value containing `../`, `@`,
  // or a scheme can steer the resulting URL somewhere else entirely --
  // including cloud metadata endpoints reachable only from this server.
  // The prefix check on publicId narrows who can try; this makes the
  // destination itself non-negotiable.
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:' || parsed.hostname !== CLOUDINARY_DELIVERY_HOST) {
    console.error('refusing to fetch derived asset outside Cloudinary:', parsed.origin);
    return null;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    // `redirect: 'error'` matters as much as the host check above: without
    // it Cloudinary (or anything impersonating it) could 302 this request
    // to an internal address after the origin has already been validated.
    const res = await fetch(parsed.toString(), { signal: controller.signal, redirect: 'error' });
    if (!res.ok) return null;
    const mediaType = res.headers.get('content-type') ?? 'image/jpeg';
    const buffer = Buffer.from(await res.arrayBuffer());
    return { base64: buffer.toString('base64'), mediaType };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  let body: { publicId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  if (typeof body.publicId !== 'string' || body.publicId.trim().length === 0) {
    return NextResponse.json({ error: '"publicId" is required.' }, { status: 400 });
  }
  const publicId = body.publicId.trim();

  // The signed upload in app/api/uploads/sign scopes every upload to
  // viral-trending/uploads/<clerk user id>/ -- refuse anything outside that
  // prefix so one user can't hand us another user's (or an arbitrary
  // public) Cloudinary asset to analyze for free.
  const expectedPrefix = `viral-trending/uploads/${userId}/`;
  if (!publicId.startsWith(expectedPrefix)) {
    return NextResponse.json({ error: 'That asset does not belong to your account.' }, { status: 403 });
  }

  // startsWith alone is not enough: "viral-trending/uploads/<me>/../../other"
  // satisfies the prefix but resolves elsewhere once it is interpolated
  // into a URL path. Restrict the id to the characters Cloudinary actually
  // uses so traversal and scheme injection cannot be expressed at all.
  if (!/^[A-Za-z0-9/_-]+$/.test(publicId) || publicId.includes('..')) {
    return NextResponse.json({ error: 'That asset id is not valid.' }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  const quotaDenied = await consumeQuotaOrRespond(admin, userId, 'analyze_upload');
  if (quotaDenied) return quotaDenied;

  try {
    // Trust Cloudinary's own record of the asset, not whatever the
    // client claims -- this is also how we confirm the upload actually
    // landed before spending a Claude call on it.
    const resource = await fetchVideoResource(publicId);

    const timestamps = pickFrameTimestamps(resource.duration);

    // buildFrameUrl/buildWaveformUrl need the cloud name, which isn't on
    // the resource lookup response -- read it back out of secure_url
    // rather than re-deriving config() here.
    const cloudNameMatch = resource.secure_url.match(/res\.cloudinary\.com\/([^/]+)\//);
    const cloudName = cloudNameMatch?.[1];
    if (!cloudName) {
      throw new Error('Could not determine Cloudinary cloud name from the asset URL.');
    }

    const frames = await Promise.all(
      timestamps.map(async (t) => {
        const fetched = await fetchImageAsBase64(buildFrameUrl(cloudName, publicId, t));
        return fetched ? { timestampSeconds: t, ...fetched } : null;
      })
    );
    const validFrames = frames.filter((f): f is NonNullable<typeof f> => f !== null);

    if (validFrames.length === 0) {
      throw new Error('Could not extract any frames from the uploaded video.');
    }

    const waveform = await fetchImageAsBase64(buildWaveformUrl(cloudName, publicId));

    const result = await generateUploadDiagnosis({
      frames: validFrames,
      waveform,
      durationSeconds: resource.duration,
    });

    const { data: report, error: insertError } = await admin
      .from('audit_reports')
      .insert({
        user_id: userId,
        source_type: 'upload',
        source_url: resource.secure_url,
        platform: null,
        viral_score: result.viral_score,
        analysis: result.analysis,
        timeline_recommendations: result.timeline_recommendations,
      })
      .select()
      .single();

    if (insertError || !report) {
      console.error('audit_reports insert failed', insertError);
      await refundQuota(admin, userId, 'analyze_upload');
      return NextResponse.json({ error: 'Could not save the diagnostic report.' }, { status: 500 });
    }

    return NextResponse.json({ report: report as AuditReportRow<UploadDiagnosis> }, { status: 200 });
  } catch (err) {
    await refundQuota(admin, userId, 'analyze_upload');
    await logEvent('error', 'analyze_upload.failed', { userId, error: err });
    return NextResponse.json(
      { error: publicErrorMessage(err, 'Diagnostic failed. It did not count against your plan; please try again.') },
      { status: errorStatus(err) }
    );
  }
}
