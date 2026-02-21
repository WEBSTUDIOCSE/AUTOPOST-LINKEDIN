/**
 * Media Storage Service — Server-Only
 *
 * Uploads AI-generated base64 images and videos to Firebase Storage,
 * returning a permanent public download URL.
 *
 * This is needed because Gemini returns images as base64 blobs that can
 * reach 500KB–2MB. Storing them inline in a Firestore document would
 * exceed the 1MB document limit and cause PostService.create to fail.
 */

import 'server-only';
import { getAdminStorage } from '@/lib/firebase/admin';

/**
 * Upload a base64-encoded image or video to Firebase Storage.
 *
 * @param base64    The raw base64 string (no `data:...;base64,` prefix).
 * @param mimeType  MIME type, e.g. 'image/png', 'video/mp4'.
 * @param folder    Storage folder, e.g. 'posts/images' or 'posts/videos'.
 * @param userId    Used to namespace the upload under the user's folder.
 * @returns Public HTTPS download URL.
 */
export async function uploadMediaToStorage({
  base64,
  mimeType,
  folder,
  userId,
}: {
  base64: string;
  mimeType: string;
  folder: string;
  userId?: string;
}): Promise<string> {
  const ext = mimeType.split('/')[1]?.split(';')[0]?.replace('jpeg', 'jpg') ?? 'bin';
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const filename = `${timestamp}-${random}.${ext}`;

  const storagePath = userId
    ? `${folder}/${userId}/${filename}`
    : `${folder}/${filename}`;

  const bucket = getAdminStorage().bucket(
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  );

  const file = bucket.file(storagePath);
  const buffer = Buffer.from(base64, 'base64');

  await file.save(buffer, {
    metadata: {
      contentType: mimeType,
      cacheControl: 'public, max-age=31536000',
    },
    resumable: false, // small files don't need resumable uploads
  });

  // Signed URL valid for 10 years — works on both ACL and UBLA buckets.
  // Media is permanent AI-generated content, no need to regenerate URLs.
  const [signedUrl] = await file.getSignedUrl({
    action: 'read',
    expires: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000,
  });

  return signedUrl;
}
