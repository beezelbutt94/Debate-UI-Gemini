import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createSignedVideoUpload } from '@/lib/cloudinary';
import { logEvent } from '@/lib/events';
import { errorStatus, publicErrorMessage } from '@/lib/errors';

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  try {
    const signed = createSignedVideoUpload(userId);
    return NextResponse.json(signed, { status: 200 });
  } catch (err) {
    await logEvent('error', 'uploads.sign_failed', { userId, error: err });
    return NextResponse.json(
      { error: publicErrorMessage(err, 'Could not prepare the upload. Please try again.') },
      { status: errorStatus(err, 500) }
    );
  }
}
