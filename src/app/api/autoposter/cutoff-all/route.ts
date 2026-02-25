/**
 * Cutoff Review — Admin Cron Endpoint
 *
 * POST /api/autoposter/cutoff-all
 *
 * Called by the Firebase scheduled function `cutoffReview` (every 5 min for testing,
 * 3 AM IST Tue–Thu in production).
 *
 * Finds all pending_review posts whose reviewDeadline has passed and sets
 * them to "skipped". Also advances the series index so the next auto-post
 * picks the next topic.
 *
 * Auth: shared CRON_SECRET secret in `x-cron-secret` header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { POSTS_COLLECTION } from '@/lib/linkedin/collections';
import { FieldValue } from 'firebase-admin/firestore';
import type { Timestamp } from 'firebase-admin/firestore';
import { SeriesService } from '@/lib/linkedin/services/series.service';

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

      // Advance series index so next run picks the next topic
      const seriesId = data.seriesId as string | null;
      if (seriesId) {
        try {
          const seriesResult = await SeriesService.getById(seriesId);
          if (seriesResult.data) {
            await SeriesService.advanceIndex(
              seriesId,
              seriesResult.data.topicQueue.length,
              seriesResult.data.currentIndex,
            );
          }
        } catch (seriesErr) {
          console.error(`[cutoff-all] Failed to advance series ${seriesId}:`, seriesErr);
        }
      }

      results.push({
        postId: doc.id,
        userId: data.userId as string,
        topic: data.topic as string,
      });
    }

    console.log(`[cutoff-all] Skipped ${results.length} posts`);
    return NextResponse.json({ success: true, skipped: results.length, results });
  } catch (err) {
    console.error('[API /autoposter/cutoff-all]', err);
    return NextResponse.json({ error: 'Internal error', details: String(err) }, { status: 500 });
  }
}
