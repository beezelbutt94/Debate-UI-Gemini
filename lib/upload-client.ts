/**
 * Browser-side video upload straight to Cloudinary using a signature minted
 * by /api/uploads/sign. The bytes never pass through our own server, which
 * is the only way around serverless request-body limits for video.
 */

export interface SignedUploadResponse {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  allowedFormats: string;
}

export interface CloudinaryUploadResponse {
  public_id: string;
  secure_url: string;
  duration?: number;
  error?: { message: string };
}

/**
 * XMLHttpRequest (not fetch) is the only way to get real upload-progress
 * events for a multipart body -- fetch's request streaming isn't paired
 * with a progress callback in browsers yet. This uploads the video bytes
 * straight to Cloudinary; they never touch our own server.
 */
export function uploadToCloudinary(
  file: File,
  signed: SignedUploadResponse,
  onProgress: (percent: number) => void
): Promise<CloudinaryUploadResponse> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', signed.apiKey);
    formData.append('timestamp', String(signed.timestamp));
    formData.append('signature', signed.signature);
    formData.append('folder', signed.folder);
    formData.append('allowed_formats', signed.allowedFormats);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `https://api.cloudinary.com/v1_1/${signed.cloudName}/video/upload`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText) as CloudinaryUploadResponse;
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(body);
        } else {
          reject(new Error(body.error?.message ?? `Cloudinary upload failed (${xhr.status})`));
        }
      } catch {
        reject(new Error(`Cloudinary upload failed (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new Error('Network error while uploading to Cloudinary.'));
    xhr.send(formData);
  });
}


export const ACCEPTED_VIDEO_TYPES = ['video/mp4', 'video/quicktime'];
/** Cloudinary's free plan caps video uploads at 100 MB. */
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

/** Validates, signs and uploads a video; resolves with Cloudinary's record. */
export async function uploadVideo(file: File, onProgress: (percent: number) => void): Promise<CloudinaryUploadResponse> {
  if (!ACCEPTED_VIDEO_TYPES.includes(file.type)) {
    throw new Error('Choose an MP4 or MOV video.');
  }
  if (file.size > MAX_VIDEO_BYTES) {
    throw new Error('That video is larger than 100 MB. Export a smaller file and try again.');
  }

  const signRes = await fetch('/api/uploads/sign', { method: 'POST' });
  let signBody: Partial<SignedUploadResponse> & { error?: string } = {};
  try {
    signBody = await signRes.json();
  } catch {
    // handled below
  }
  if (!signRes.ok) throw new Error(signBody.error ?? 'Could not start the upload. Please try again.');

  return uploadToCloudinary(file, signBody as SignedUploadResponse, onProgress);
}
