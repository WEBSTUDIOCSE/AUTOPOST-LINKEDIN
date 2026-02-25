/**
 * Autoposter Test Trigger API
 *
 * POST /api/autoposter/trigger — manually trigger draft generation for the
 * current user. Mimics what the Firebase scheduled function `generateDrafts`
 * would do, but runs on-demand in the Next.js runtime.
 *
 * Body:
 *   scheduledFor?: ISO string — when to schedule the post (default: now + 5 min)
 *
 * This lets us test the full autoposter pipeline without deploying
 * Firebase Functions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/server';
import { ProfileService } from '@/lib/linkedin/services/profile.service';
import { SeriesService } from '@/lib/linkedin/services/series.service';
import { IdeaService } from '@/lib/linkedin/services/idea.service';
import { PostService } from '@/lib/linkedin/services/post.service';
import { TemplateService } from '@/lib/linkedin/services/template.service';
import { generatePostDraft } from '@/lib/linkedin/services/post-generator.service';
import type { PostMediaType } from '@/lib/linkedin/types';

export const maxDuration = 300; // 5 minutes — AI generation can be slow

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));

    // ── Load user profile ────────────────────────────────────────────────

    const profileResult = await ProfileService.get(user.uid);
    const profile = profileResult.data;
    if (!profile) {
      return NextResponse.json(
        { error: 'No autoposter profile found. Go to Settings first.' },
        { status: 400 },
      );
    }

    // ── Determine topic from series or idea bank ─────────────────────────

    const seriesResult = await SeriesService.getActiveSeries(user.uid);
    const series = seriesResult.data;

    // Check idea bank first
    const ideaResult = await IdeaService.getNextUnused(user.uid, series?.id);
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
      // Mark idea as used
      await IdeaService.markUsed(idea.id);
    } else if (series && series.currentIndex < series.topicQueue.length) {
      const t = series.topicQueue[series.currentIndex];
      topic = t.title;
      notes = t.notes;
      seriesId = series.id;
      topicIndex = series.currentIndex;
      seriesTitle = series.title;
    } else {
      return NextResponse.json(
        {
          error: 'No topics available. Add ideas or topics to your series.',
          details: series
            ? `Series "${series.title}" is completed (index ${series.currentIndex}/${series.topicQueue.length}).`
            : 'No active series found.',
        },
        { status: 400 },
      );
    }

    // ── Get continuity context ───────────────────────────────────────────

    let previousPostSummary: string | undefined;
    if (seriesId) {
      const lastPostResult = await PostService.getLastPublishedInSeries(user.uid, seriesId);
      if (lastPostResult.data) {
        previousPostSummary = lastPostResult.data.previousPostSummary;
      }
    }

    // ── Resolve media type + template ────────────────────────────────────

    const mediaType: PostMediaType = profile.preferredMediaType ?? 'text';

    let templateId: string | undefined;
    let templateHtml: string | undefined;
    let templateDimensions: { width: number; height?: number } | undefined;
    let pageCount = 1;

    if (mediaType === 'html') {
      // Use series template or first available template
      const tplId = series?.templateId;
      if (tplId) {
        const tplResult = await TemplateService.getById(tplId);
        if (tplResult.data && tplResult.data.userId === user.uid) {
          templateId = tplId;
          templateHtml = tplResult.data.htmlContent;
          templateDimensions = tplResult.data.dimensions;
        }
      }
      pageCount = 3; // default carousel pages for auto-generated
    }

    // ── Calculate schedule times ─────────────────────────────────────────

    const scheduledFor = body.scheduledFor
      ? new Date(body.scheduledFor)
      : new Date(Date.now() + 5 * 60 * 1000); // default: now + 5 min

    const reviewDeadline = new Date(scheduledFor.getTime() - 30 * 60 * 1000); // 30 min before post

    const dayName = scheduledFor.toLocaleDateString('en-US', { weekday: 'long' });

    // ── Generate draft with AI ───────────────────────────────────────────

    console.log(`[trigger] Generating draft for "${topic}" (${mediaType}) scheduled at ${scheduledFor.toISOString()}`);

    const draft = await generatePostDraft({
      userId: user.uid,
      topic,
      notes,
      seriesTitle,
      previousPostSummary,
      persona: profile.persona ?? undefined,
      publishDay: dayName,
      mediaType,
      // Template
      templateId,
      templateHtml,
      templateDimensions,
      pageCount,
      // Model control — use profile preferences
      provider: profile.preferredProvider,
      textModel: profile.preferredTextModel,
    });

    // ── Save to Firestore ────────────────────────────────────────────────

    const result = await PostService.create({
      userId: user.uid,
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

    if (!result.success || !result.data) {
      console.error('[trigger] PostService.create failed:', result.error);
      return NextResponse.json(
        { error: result.error ?? 'Failed to save post' },
        { status: 500 },
      );
    }

    console.log(`[trigger] Draft created — postId: ${result.data}`);

    return NextResponse.json({
      success: true,
      data: {
        postId: result.data,
        topic,
        seriesTitle,
        topicIndex,
        mediaType,
        scheduledFor: scheduledFor.toISOString(),
        contentPreview: draft.content.slice(0, 200) + (draft.content.length > 200 ? '…' : ''),
        hasHtml: !!draft.htmlContent,
        hasMedia: !!draft.media,
        ...(draft.mediaGenerationError && { mediaWarning: draft.mediaGenerationError }),
      },
    });
  } catch (err) {
    console.error('[API /autoposter/trigger]', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: message.replace(/^\[\w+\]\s*/, '') || 'Trigger failed' },
      { status: 500 },
    );
  }
}
