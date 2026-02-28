/**
 * Publish All — Admin Cron Endpoint
 *
 * POST /api/autoposter/publish-all
 *
 * Called by the Firebase scheduled function `publishPosts` (every 5 min for testing,
 * every 30 min 8–11 AM IST Tue–Thu in production).
 *
 * Finds all approved posts whose scheduledFor time has passed and publishes
 * them to LinkedIn. Handles token refresh, media upload, and series advancement.
 *
 * Auth: shared CRON_SECRET secret in `x-cron-secret` header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase/admin';
import { POSTS_COLLECTION } from '@/lib/linkedin/collections';
import { FieldValue } from 'firebase-admin/firestore';
import type { Timestamp } from 'firebase-admin/firestore';
import { ProfileService } from '@/lib/linkedin/services/profile.service';
import { PostService } from '@/lib/linkedin/services/post.service';
import { SeriesService } from '@/lib/linkedin/services/series.service';
import { sendPushNotification } from '@/lib/linkedin/services/push.service';
import {
  createLinkedInPost,
  uploadImageToLinkedIn,
  uploadVideoToLinkedIn,
  downloadMediaAsBuffer,
  refreshAccessToken,
} from '@/lib/linkedin/linkedin-oauth';
import type { PostMediaType } from '@/lib/linkedin/types';

export const maxDuration = 300; // LinkedIn uploads can be slow

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
  const results: { postId: string; userId: string; topic: string; status: string; detail?: string }[] = [];

  try {
    const db = getAdminDb();

    // Query all approved posts
    const snap = await db.collection(POSTS_COLLECTION)
      .where('status', '==', 'approved')
      .get();

    for (const doc of snap.docs) {
      const data = doc.data();
      const postId = doc.id;
      const userId = data.userId as string;
      const topic = data.topic as string;
      const scheduledFor = (data.scheduledFor as Timestamp)?.toDate?.() ?? new Date(0);

      // Not due yet
      if (scheduledFor > now) continue;

      try {
        // Load profile for LinkedIn tokens
        const profileResult = await ProfileService.get(userId);
        const profile = profileResult.data;

        if (!profile?.linkedinConnected || !profile.linkedinAccessToken || !profile.linkedinMemberUrn) {
          await PostService.markFailed(postId, 'LinkedIn not connected');
          results.push({ postId, userId, topic, status: 'failed', detail: 'LinkedIn not connected' });
          continue;
        }

        // Refresh token if expired
        let accessToken = profile.linkedinAccessToken;
        if (profile.linkedinTokenExpiry && new Date(profile.linkedinTokenExpiry) < now) {
          if (!profile.linkedinRefreshToken) {
            await PostService.markFailed(postId, 'LinkedIn token expired — reconnect required');
            results.push({ postId, userId, topic, status: 'failed', detail: 'token expired, no refresh token' });
            continue;
          }
          try {
            const newTokens = await refreshAccessToken(profile.linkedinRefreshToken);
            accessToken = newTokens.accessToken;
            // Update stored tokens
            await ProfileService.setLinkedInTokens(userId, {
              accessToken: newTokens.accessToken,
              refreshToken: newTokens.refreshToken,
              expiresIn: newTokens.expiresIn,
              memberUrn: profile.linkedinMemberUrn,
            });
          } catch {
            await PostService.markFailed(postId, 'Token refresh failed');
            results.push({ postId, userId, topic, status: 'failed', detail: 'token refresh failed' });
            continue;
          }
        }

        const mediaType = (data.mediaType as PostMediaType) ?? 'text';
        const content = (data.editedContent as string | null)
          ?? (data.content as string);

        // ── Build LinkedIn media assets ──────────────────────────────────

        let mediaAssetUrns: string[] | undefined;
        let mediaAssetUrn: string | undefined;

        if (mediaType === 'html') {
          // HTML posts: use pre-captured PNG URLs stored at approval time
          const imageUrls = data.imageUrls as string[] | undefined;
          if (imageUrls && imageUrls.length > 0) {
            const urns: string[] = [];
            for (const url of imageUrls) {
              const buf = await downloadMediaAsBuffer(url);
              const { imageUrn } = await uploadImageToLinkedIn(
                accessToken,
                profile.linkedinMemberUrn,
                buf,
              );
              urns.push(imageUrn);
            }
            mediaAssetUrns = urns.length > 1 ? urns : undefined;
            mediaAssetUrn = urns.length === 1 ? urns[0] : undefined;
          }
          // If no imageUrls, publish as text-only (HTML wasn't pre-captured)
        } else if (data.mediaUrl) {
          const buf = await downloadMediaAsBuffer(data.mediaUrl as string);
          if (mediaType === 'image') {
            const { imageUrn } = await uploadImageToLinkedIn(
              accessToken,
              profile.linkedinMemberUrn,
              buf,
            );
            mediaAssetUrn = imageUrn;
          } else if (mediaType === 'video') {
            const { videoUrn } = await uploadVideoToLinkedIn(
              accessToken,
              profile.linkedinMemberUrn,
              buf,
            );
            mediaAssetUrn = videoUrn;
          }
        }

        // ── Publish to LinkedIn ──────────────────────────────────────────

        const linkedinPostId = await createLinkedInPost({
          accessToken,
          authorUrn: profile.linkedinMemberUrn,
          text: content,
          mediaType,
          mediaAssetUrn: mediaAssetUrns ? mediaAssetUrns[0] : mediaAssetUrn,
          mediaAssetUrns,
        });

        // ── Mark published in Firestore (direct update for speed) ────────

        await db.collection(POSTS_COLLECTION).doc(postId).update({
          status: 'published',
          linkedinPostId,
          publishedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        // ── Advance series index ─────────────────────────────────────────

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
            console.error(`[publish-all] Failed to advance series ${seriesId}:`, seriesErr);
          }
        }

        results.push({ postId, userId, topic, status: 'published', detail: linkedinPostId });

        // Notify user that their post was published
        sendPushNotification(userId, {
          type: 'post_published',
          title: '🚀 Post Published!',
          body: `Your post "${topic}" is now live on LinkedIn.`,
          postId,
          clickAction: '/posts',
        }).catch(() => {});
      } catch (postErr) {
        const msg = postErr instanceof Error ? postErr.message : String(postErr);
        console.error(`[publish-all] Failed to publish post ${postId}:`, postErr);
        await PostService.markFailed(postId, msg).catch(() => null);
        results.push({ postId, userId, topic, status: 'failed', detail: msg });

        // Notify user that publish failed
        sendPushNotification(userId, {
          type: 'post_failed',
          title: '❌ Post Failed',
          body: `Failed to publish "${topic}": ${msg.slice(0, 100)}`,
          postId,
          clickAction: '/posts',
        }).catch(() => {});
      }
    }

    console.log(`[publish-all] Processed ${results.length} posts`);
    return NextResponse.json({ success: true, processed: results.length, results });
  } catch (err) {
    console.error('[API /autoposter/publish-all]', err);
    return NextResponse.json({ error: 'Internal error', details: String(err) }, { status: 500 });
  }
}
