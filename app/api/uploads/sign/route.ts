import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createSignedVideoUpload } from '@/lib/cloudinary';

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated.' }, { status: 401 });
  }

  try {
    const signed = createSignedVideoUpload(userId);
    return NextResponse.json(signed, { status: 200 });
  } catch (err) {
    console.error('uploads/sign failed', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not sign upload.' },
      { status: 500 }
    );
  }
}
