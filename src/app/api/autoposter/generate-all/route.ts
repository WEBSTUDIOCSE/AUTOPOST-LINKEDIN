/**
 * Generate All — Admin Cron Endpoint
 *
 * POST /api/autoposter/generate-all
 *
 * Called by the Firebase scheduled function `generateDrafts` (every 1 hour).
 *
 * Schedule-first flow:
 *   1. Find all posts with status = 'scheduled' whose scheduledFor is within
 *      the next 28 hours (covers same-day + tomorrow posts)
 *   2. Only process users whose current hour matches their draftGenerationHour
 *   3. For each: generate AI draft content using the saved model/media preferences
 *   4. Update the post: fill in content, set status → pending_review
 *
 * Users first "book" posts via the Schedule dialog (just topic + time slot),
 * and the AI draft is created automatically the night before at draftGenerationHour.
 *
 * Auth: shared CRON_SECRET secret in `x-cron-secret` header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ProfileService } from '@/lib/linkedin/services/profile.service';
import { SeriesService } from '@/lib/linkedin/services/series.service';
import { PostService } from '@/lib/linkedin/services/post.service';
import { TemplateService } from '@/lib/linkedin/services/template.service';
import { generatePostDraft } from '@/lib/linkedin/services/post-generator.service';
import { getAdminDb } from '@/lib/firebase/admin';
import { POSTS_COLLECTION } from '@/lib/linkedin/collections';
import { FieldValue } from 'firebase-admin/firestore';
import type { Timestamp } from 'firebase-admin/firestore';
import type { PostMediaType } from '@/lib/linkedin/types';

export const maxDuration = 300; // AI generation can be slow

// ── Auth helper ──────────────────────────────────────────────────────────────

function isAuthorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('x-cron-secret') === secret;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Check if now is the right hour to generate drafts for a user.
 * Returns true if the current hour in the user's timezone matches their draftGenerationHour.
 */
function isDraftHour(timezone: string, draftGenerationHour: number): boolean {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hour12: false,
    timeZone: timezone,
  });
  const currentHour = parseInt(formatter.format(now), 10);
  return currentHour === draftGenerationHour;
}

/**
 * Get range of posts to generate drafts for: from NOW to 28 hours ahead.
 * This covers both same-day posts (scheduled later today) and tomorrow's posts.
 * E.g. if draftGenerationHour=10 and a post is scheduled for today 1 PM, it will generate.
 */
function getUpcomingRange(): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now.getTime() + 28 * 60 * 60 * 1000); // 28 hours ahead
  return { start: now, end };
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: { postId: string; userId: string; status: string; detail?: string }[] = [];

  try {
    // 1. Get all scheduled posts (not yet generated)
    const db = getAdminDb();
    const scheduledSnap = await db.collection(POSTS_COLLECTION)
      .where('status', '==', 'scheduled')
      .get();

    if (scheduledSnap.empty) {
      return NextResponse.json({ success: true, processed: 0, results, message: 'No scheduled posts to process' });
    }

    // 2. Load all profiles (cached per run for efficiency)
    const profilesResult = await ProfileService.getAllProfiles();
    const profileMap = new Map((profilesResult.data ?? []).map(p => [p.userId, p]));

    // 3. Process each scheduled post
    for (const doc of scheduledSnap.docs) {
      const data = doc.data();
      const postId = doc.id;
      const userId = data.userId as string;

      try {
        // Get user profile
        const profile = profileMap.get(userId);
        if (!profile) {
          results.push({ postId, userId, status: 'skipped', detail: 'no profile found' });
          continue;
        }

        const timezone = profile.timezone || 'Asia/Kolkata';
        const draftHour = profile.draftGenerationHour ?? 21;

        // Check if now is the right time to generate for this user
        if (!isDraftHour(timezone, draftHour)) {
          // Not this user's draft hour — skip for now, will be picked up next run
          continue;
        }

        // Check if the post's scheduledFor is within the next 28 hours
        const scheduledFor = (data.scheduledFor as Timestamp)?.toDate?.();
        if (!scheduledFor) {
          results.push({ postId, userId, status: 'skipped', detail: 'no scheduledFor date' });
          continue;
        }

        const { start, end } = getUpcomingRange();
        if (scheduledFor < start || scheduledFor >= end) {
          // Not within the generation window — skip, will be picked up later
          continue;
        }

        // 4. Gather series context
        const seriesId = data.seriesId as string | null;
        let seriesTitle: string | undefined;
        let previousPostSummary: string | undefined;

        if (seriesId) {
          const seriesResult = await SeriesService.getById(seriesId);
          if (seriesResult.data) {
            seriesTitle = seriesResult.data.title;
          }

          const lastPost = await PostService.getLastPublishedInSeries(userId, seriesId);
          if (lastPost.data) previousPostSummary = lastPost.data.previousPostSummary ?? undefined;
        }

        // 5. Resolve media type + template
        const mediaType = (data.mediaType as PostMediaType) || profile.preferredMediaType || 'text';
        const savedTemplateId = (data.templateId as string | null) ?? undefined;
        let templateHtml: string | undefined;
        let templateDimensions: { width: number; height?: number } | undefined;

        if (mediaType === 'html' && savedTemplateId) {
          const tplResult = await TemplateService.getById(savedTemplateId);
          if (tplResult.data && tplResult.data.userId === userId) {
            templateHtml = tplResult.data.htmlContent;
            templateDimensions = tplResult.data.dimensions;
          }
        }

        const pageCount = (data.pageCount as number) || 1;
        const topic = data.topic as string;
        const notes = (data.notes as string) || undefined;
        const dayName = scheduledFor.toLocaleDateString('en-US', { weekday: 'long' });
        const pageInstructions = Array.isArray(data.pageInstructions) ? data.pageInstructions as string[] : undefined;

        // 6. Generate AI draft
        const draft = await generatePostDraft({
          userId,
          topic,
          notes,
          seriesTitle,
          previousPostSummary,
          persona: profile.persona ?? undefined,
          publishDay: dayName,
          mediaType,
          templateId: savedTemplateId,
          templateHtml,
          templateDimensions,
          pageCount,
          pageInstructions,
          provider: ((data.provider as string) || profile.preferredProvider) as 'gemini' | 'kieai' | undefined,
          textModel: (data.textModel as string) || profile.preferredTextModel,
        });

        // 7. Calculate review deadline from user's settings (on the same day as scheduledFor)
        const reviewDeadlineHour = profile.reviewDeadlineHour ?? 3;
        const fmtDate = new Intl.DateTimeFormat('en-CA', {
          year: 'numeric', month: '2-digit', day: '2-digit',
          timeZone: timezone,
        });
        const postDateStr = fmtDate.format(scheduledFor);
        const reviewDeadline = new Date(`${postDateStr}T${String(reviewDeadlineHour).padStart(2, '0')}:00:00`);

        // 8. Update the post with generated content → pending_review
        await doc.ref.update({
          content: draft.content,
          previousPostSummary: draft.summary ?? null,
          inputPrompt: `[Auto] Topic: ${topic}${notes ? `\nNotes: ${notes}` : ''}`,
          mediaUrl: draft.media?.url ?? null,
          mediaMimeType: draft.media?.mimeType ?? null,
          mediaPrompt: draft.media?.prompt ?? null,
          htmlContent: draft.htmlContent ?? null,
          reviewDeadline,
          status: 'pending_review',
          updatedAt: FieldValue.serverTimestamp(),
        });

        results.push({ postId, userId, status: 'generated', detail: topic });
      } catch (postErr) {
        const msg = postErr instanceof Error ? postErr.message : String(postErr);
        console.error(`[generate-all] Failed for post ${postId} (user ${userId}):`, postErr);
        results.push({ postId, userId, status: 'error', detail: msg });
      }
    }

    return NextResponse.json({ success: true, processed: results.length, results });
  } catch (err) {
    console.error('[API /autoposter/generate-all]', err);
    return NextResponse.json({ error: 'Internal error', details: String(err) }, { status: 500 });
  }
}
