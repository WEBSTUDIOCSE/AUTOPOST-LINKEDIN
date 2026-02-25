/**
 * Generate All — Admin Cron Endpoint
 *
 * POST /api/autoposter/generate-all
 *
 * Called by the Firebase scheduled function `generateDrafts` (every 5 min for testing,
 * 9 PM IST Mon–Wed in production).
 *
 * For each autoposter profile:
 *   1. Check if tomorrow is a posting day for that user
 *   2. Skip if they already have a post scheduled for tomorrow
 *   3. Pick next topic from active series or idea bank
 *   4. Generate AI draft using their preferred model/media settings
 *   5. Save as pending_review with the correct posting time
 *
 * Auth: shared CRON_SECRET secret in `x-cron-secret` header.
 */

import { NextRequest, NextResponse } from 'next/server';
import { ProfileService } from '@/lib/linkedin/services/profile.service';
import { SeriesService } from '@/lib/linkedin/services/series.service';
import { IdeaService } from '@/lib/linkedin/services/idea.service';
import { PostService } from '@/lib/linkedin/services/post.service';
import { TemplateService } from '@/lib/linkedin/services/template.service';
import { generatePostDraft } from '@/lib/linkedin/services/post-generator.service';
import { getAdminDb } from '@/lib/firebase/admin';
import { POSTS_COLLECTION } from '@/lib/linkedin/collections';
import type { PostingSchedule, PostMediaType } from '@/lib/linkedin/types';

export const maxDuration = 300; // AI generation can be slow

// ── Auth helper ──────────────────────────────────────────────────────────────

function isAuthorised(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get('x-cron-secret') === secret;
}

// ── Day helpers ──────────────────────────────────────────────────────────────

const DAY_KEYS: (keyof PostingSchedule)[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
];

function getTomorrowDayKey(timezone: string): keyof PostingSchedule {
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  // Returns e.g. "wednesday"
  const name = tomorrow.toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone }).toLowerCase();
  return (DAY_KEYS.includes(name as keyof PostingSchedule)
    ? name : 'monday') as keyof PostingSchedule;
}

function buildScheduledForDate(timezone: string, postTime: string): Date {
  // Build a Date for tomorrow at the given postTime in the user's timezone
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const [h, m] = postTime.split(':').map(Number);

  // Use Intl to format tomorrow's date in user's timezone, then build a timestamp
  const fmt = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    timeZone: timezone,
  });
  const dateStr = fmt.format(tomorrow); // "YYYY-MM-DD"
  return new Date(`${dateStr}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
}

function getTomorrowDateRange(timezone: string): { start: Date; end: Date } {
  const start = buildScheduledForDate(timezone, '00:00');
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

// ── Check if user already has a draft for tomorrow ───────────────────────────

async function hasExistingPostForTomorrow(userId: string, timezone: string): Promise<boolean> {
  const { start, end } = getTomorrowDateRange(timezone);
  const db = getAdminDb();
  // Query by userId + scheduledFor range (no status filter — filter in JS to avoid composite index)
  const snap = await db.collection(POSTS_COLLECTION)
    .where('userId', '==', userId)
    .where('scheduledFor', '>=', start)
    .where('scheduledFor', '<', end)
    .limit(5)
    .get();
  // Only count active posts (not rejected/skipped/failed)
  return snap.docs.some(d => {
    const s = d.data().status as string;
    return s === 'pending_review' || s === 'approved';
  });
}

// ── Main handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  if (!isAuthorised(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: { userId: string; status: string; detail?: string }[] = [];

  try {
    const profilesResult = await ProfileService.getAllProfiles();
    const profiles = profilesResult.data ?? [];

    for (const profile of profiles) {
      const userId = profile.userId;
      try {
        const timezone = profile.timezone || 'Asia/Kolkata';

        // 1. Check if tomorrow is a posting day
        const dayKey = getTomorrowDayKey(timezone);
        const dayConfig = profile.postingSchedule?.[dayKey];
        if (!dayConfig?.enabled) {
          results.push({ userId, status: 'skipped', detail: `${dayKey} not a posting day` });
          continue;
        }

        // 2. Skip if already has a draft for tomorrow
        const alreadyHas = await hasExistingPostForTomorrow(userId, timezone);
        if (alreadyHas) {
          results.push({ userId, status: 'skipped', detail: 'already has post for tomorrow' });
          continue;
        }

        // 3. Determine topic
        const seriesResult = await SeriesService.getActiveSeries(userId);
        const series = seriesResult.data;
        const ideaResult = await IdeaService.getNextUnused(userId, series?.id);
        const idea = ideaResult.data;

        let topic: string;
        let notes: string | undefined;
        let seriesId: string | undefined;
        let topicIndex: number | undefined;
        let seriesTitle: string | undefined;

        if (idea) {
          topic = idea.text;
          seriesId = idea.seriesId ?? series?.id;
          seriesTitle = series?.title;
          await IdeaService.markUsed(idea.id);
        } else if (series && series.currentIndex < series.topicQueue.length) {
          const t = series.topicQueue[series.currentIndex];
          topic = t.title;
          notes = t.notes;
          seriesId = series.id;
          topicIndex = series.currentIndex;
          seriesTitle = series.title;
        } else {
          results.push({ userId, status: 'skipped', detail: 'no topics available' });
          continue;
        }

        // 4. Get continuity context
        let previousPostSummary: string | undefined;
        if (seriesId) {
          const lastPost = await PostService.getLastPublishedInSeries(userId, seriesId);
          if (lastPost.data) previousPostSummary = lastPost.data.previousPostSummary ?? undefined;
        }

        // 5. Resolve media type + template
        const mediaType: PostMediaType = profile.preferredMediaType ?? 'text';
        let templateId: string | undefined;
        let templateHtml: string | undefined;
        let templateDimensions: { width: number; height?: number } | undefined;
        let pageCount = 1;

        if (mediaType === 'html') {
          const tplId = series?.templateId;
          if (tplId) {
            const tplResult = await TemplateService.getById(tplId);
            if (tplResult.data && tplResult.data.userId === userId) {
              templateId = tplId;
              templateHtml = tplResult.data.htmlContent;
              templateDimensions = tplResult.data.dimensions;
            }
          }
          pageCount = 3;
        }

        // 6. Calculate schedule
        const scheduledFor = buildScheduledForDate(timezone, dayConfig.postTime);
        const reviewDeadline = new Date(scheduledFor.getTime() - 60 * 60 * 1000); // 1 hour before
        const dayName = scheduledFor.toLocaleDateString('en-US', { weekday: 'long' });

        // 7. Generate draft
        const draft = await generatePostDraft({
          userId,
          topic,
          notes,
          seriesTitle,
          previousPostSummary,
          persona: profile.persona ?? undefined,
          publishDay: dayName,
          mediaType,
          templateId,
          templateHtml,
          templateDimensions,
          pageCount,
          provider: profile.preferredProvider,
          textModel: profile.preferredTextModel,
        });

        // 8. Save to Firestore
        await PostService.create({
          userId,
          topic,
          content: draft.content,
          scheduledFor,
          reviewDeadline,
          seriesId,
          topicIndex,
          previousPostSummary: draft.summary,
          inputPrompt: `[Auto] Topic: ${topic}${notes ? `\nNotes: ${notes}` : ''}`,
          mediaType,
          mediaUrl: draft.media?.url,
          mediaMimeType: draft.media?.mimeType,
          mediaPrompt: draft.media?.prompt,
          htmlContent: draft.htmlContent,
          pageCount,
        });

        results.push({ userId, status: 'generated', detail: topic });
      } catch (userErr) {
        const msg = userErr instanceof Error ? userErr.message : String(userErr);
        console.error(`[generate-all] Failed for user ${userId}:`, userErr);
        results.push({ userId, status: 'error', detail: msg });
      }
    }

    return NextResponse.json({ success: true, processed: results.length, results });
  } catch (err) {
    console.error('[API /autoposter/generate-all]', err);
    return NextResponse.json({ error: 'Internal error', details: String(err) }, { status: 500 });
  }
}
