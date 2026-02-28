/**
 * Cutoff Review — Admin Cron Endpoint
 *
 * POST /api/autoposter/cutoff-all
 *
 * Called by the Firebase scheduled function `cutoffReview` (every 5 min for testing,
 * 3 AM IST Tue–Thu in production).
 *
 * Finds all pending_review posts whose reviewDeadline has passed and sets
 * them to "skipped". Series index is NOT advanced here — only publish advances
 * the series, so skipped/rejected topics can be retried.
 *
 * Auth: shared CRON_SECRET secret in `x-cron-secret` header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { POSTS_COLLECTION } from '@/lib/linkedin/collections';
import { FieldValue } from 'firebase-admin/firestore';
import type { Timestamp } from 'firebase-admin/firestore';
import { sendPushNotification } from '@/lib/linkedin/services/push.service';

export const maxDuration = 60;

function isAuthorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('x-cron-secret') === secret;
}

export async function POST(request: NextRequest) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  const results: { postId: string; userId: string; topic: string }[] = [];

  try {
    const db = getAdminDb();

    // Query all pending_review posts
    const snap = await db.collection(POSTS_COLLECTION)
      .where('status', '==', 'pending_review')
      .get();

    for (const doc of snap.docs) {
      const data = doc.data();
      const reviewDeadline = (data.reviewDeadline as Timestamp)?.toDate?.() ?? new Date(0);

      if (reviewDeadline > now) continue; // not expired yet

      // Skip the post
      await doc.ref.update({
        status: 'skipped',
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Series index is NOT advanced on skip/cutoff.
      // Only publish advances the series so rejected/skipped topics can be retried.

      results.push({
        postId: doc.id,
        userId: data.userId as string,
        topic: data.topic as string,
      });

      // Notify user that the review deadline passed
      try {
        const sent = await sendPushNotification(data.userId as string, {
          type: 'post_skipped',
          title: '⏰ Review Deadline Passed',
          body: `"${data.topic as string}" was skipped because the review deadline passed. It will be regenerated.`,
          postId: doc.id,
          clickAction: '/posts',
        });
        if (!sent) {
          console.warn(`[cutoff-all] Push notification NOT sent for post ${doc.id} (user ${data.userId}) — FCM token may be missing or invalid`);
        }
      } catch (pushErr) {
        console.error(`[cutoff-all] Push notification error for post ${doc.id}:`, pushErr);
      }
    }

    console.log(`[cutoff-all] Skipped ${results.length} posts`);
    return NextResponse.json({ success: true, skipped: results.length, results });
  } catch (err) {
    console.error('[API /autoposter/cutoff-all]', err);
    return NextResponse.json({ error: 'Internal error', details: String(err) }, { status: 500 });
  }
}
