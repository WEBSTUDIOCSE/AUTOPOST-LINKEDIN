/**
 * Post Management API
 *
 * POST  /api/posts — generate AI content (instant or scheduled mode)
 * GET   /api/posts — list user's posts
 * PATCH /api/posts — approve / reject / edit / retry / regenerate / publish
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/server';
import { PostService } from '@/lib/linkedin/services/post.service';
import { SeriesService } from '@/lib/linkedin/services/series.service';
import { IdeaService } from '@/lib/linkedin/services/idea.service';
import { ProfileService } from '@/lib/linkedin/services/profile.service';
import { generatePostDraft, regeneratePostDraft } from '@/lib/linkedin/services/post-generator.service';
import { createLinkedInPost } from '@/lib/linkedin/linkedin-oauth';
import type { PostMediaType } from '@/lib/linkedin/types';

// ── Validation constants ─────────────────────────────────────────────────────

const VALID_PROVIDERS = ['gemini', 'kieai'] as const;
const VALID_ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '4:5', '5:4', '2:3', '3:2', '21:9'];
const VALID_IMAGE_SIZES = ['1K', '2K', '4K'];
const VALID_VIDEO_RESOLUTIONS = ['720p', '1080p', '4k'];

// ═══════════════════════════════════════════════════════════════════════════════
// POST — Generate AI content
//
// Body:
//   mode: 'instant' | 'scheduled'  (default 'scheduled')
//   topic: string (required)
//   mediaType: 'text' | 'image' | 'video'  (default 'text')
//   notes?: string
//   seriesId?: string
//
//   -- Model control (all optional, defaults to env config) --
//   provider?: 'gemini' | 'kieai'
//   textModel?: string
//   imageModel?: string
//   videoModel?: string
//   temperature?: number (0–2)
//   maxTokens?: number (1–8192)
//
//   -- Media config (optional) --
//   aspectRatio?: string
//   imageSize?: '1K' | '2K' | '4K'
//   numberOfImages?: number (1–4)
//   durationSeconds?: number
//   videoResolution?: '720p' | '1080p' | '4k'
//   negativePrompt?: string
//
//   -- Scheduled mode only --
//   scheduledFor: ISO string (required)
//   reviewDeadline: ISO string (required)
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const mode: 'instant' | 'scheduled' = body.mode ?? 'scheduled';
    const mediaType: PostMediaType = body.mediaType ?? 'text';
    const { topic, notes, seriesId } = body;

    if (!topic) {
      return NextResponse.json({ error: 'Missing required field: topic' }, { status: 400 });
    }

    // ── Validate model control fields ────────────────────────────────────────

    const provider = body.provider && VALID_PROVIDERS.includes(body.provider)
      ? body.provider as 'gemini' | 'kieai'
      : undefined;

    const textModel = typeof body.textModel === 'string' ? body.textModel.trim() : undefined;
    const imageModel = typeof body.imageModel === 'string' ? body.imageModel.trim() : undefined;
    const videoModel = typeof body.videoModel === 'string' ? body.videoModel.trim() : undefined;

    const temperature = typeof body.temperature === 'number'
      ? Math.max(0, Math.min(2, body.temperature))
      : undefined;

    const maxTokens = typeof body.maxTokens === 'number'
      ? Math.max(1, Math.min(8192, Math.floor(body.maxTokens)))
      : undefined;

    // ── Validate media config ────────────────────────────────────────────────

    const aspectRatio = VALID_ASPECT_RATIOS.includes(body.aspectRatio ?? '')
      ? body.aspectRatio as string
      : undefined;

    const imageSize = VALID_IMAGE_SIZES.includes(body.imageSize ?? '')
      ? body.imageSize as string
      : undefined;

    const numberOfImages = typeof body.numberOfImages === 'number'
      ? Math.max(1, Math.min(4, Math.floor(body.numberOfImages)))
      : undefined;

    const durationSeconds = typeof body.durationSeconds === 'number'
      ? Math.max(1, Math.min(30, Math.floor(body.durationSeconds)))
      : undefined;

    const videoResolution = VALID_VIDEO_RESOLUTIONS.includes(body.videoResolution ?? '')
      ? body.videoResolution as string
      : undefined;

    const negativePrompt = typeof body.negativePrompt === 'string'
      ? body.negativePrompt.trim().slice(0, 500)
      : undefined;

    // ── Get profile & series context ─────────────────────────────────────────

    const profileResult = await ProfileService.get(user.uid);
    const profile = profileResult.data;

    let seriesTitle: string | undefined;
    let previousPostSummary: string | undefined;
    let topicIndex: number | undefined;

    if (seriesId) {
      const seriesResult = await SeriesService.getById(seriesId);
      if (seriesResult.data) {
        seriesTitle = seriesResult.data.title;
        topicIndex = seriesResult.data.currentIndex;
      }

      const lastPostResult = await PostService.getLastPublishedInSeries(user.uid, seriesId);
      if (lastPostResult.data) {
        previousPostSummary = lastPostResult.data.previousPostSummary;
      }
    }

    // ── Determine schedule times ─────────────────────────────────────────────

    const now = new Date();
    const scheduledFor = mode === 'instant' ? now : new Date(body.scheduledFor);
    const reviewDeadline = mode === 'instant' ? now : new Date(body.reviewDeadline);

    if (mode === 'scheduled' && (!body.scheduledFor || !body.reviewDeadline)) {
      return NextResponse.json(
        { error: 'Missing required fields for scheduled mode: scheduledFor, reviewDeadline' },
        { status: 400 },
      );
    }

    // ── Generate draft with AI ───────────────────────────────────────────────

    const dayName = scheduledFor.toLocaleDateString('en-US', { weekday: 'long' });
    const draft = await generatePostDraft({
      userId: user.uid,
      topic,
      notes,
      seriesTitle,
      previousPostSummary,
      persona: profile?.persona ?? undefined,
      publishDay: dayName,
      mediaType,
      // Model control
      provider,
      textModel,
      imageModel,
      videoModel,
      temperature,
      maxTokens,
      // Media config
      aspectRatio,
      imageSize,
      numberOfImages,
      durationSeconds,
      videoResolution,
      negativePrompt,
    });

    // Save to Firestore
    const result = await PostService.create({
      userId: user.uid,
      topic,
      content: draft.content,
      scheduledFor,
      reviewDeadline,
      seriesId,
      topicIndex,
      previousPostSummary: draft.summary,
      inputPrompt: `Topic: ${topic}${notes ? `\nNotes: ${notes}` : ''}`,
      mediaType,
      mediaUrl: draft.media?.url,
      mediaMimeType: draft.media?.mimeType,
      mediaPrompt: draft.media?.prompt,
    });

    if (!result.success || !result.data) {
      console.error('[API /posts POST] PostService.create failed:', result.error);
      return NextResponse.json(
        { error: result.error ?? 'Failed to save post to database' },
        { status: 500 },
      );
    }

    const postId = result.data;

    // For instant mode, auto-approve so user can publish right away
    if (mode === 'instant') {
      await PostService.approve(postId);
    }

    return NextResponse.json({
      success: true,
      data: {
        postId,
        content: draft.content,
        summary: draft.summary,
        media: draft.media,
        mediaType,
        mode,
        ...(draft.mediaGenerationError && { mediaWarning: draft.mediaGenerationError }),
      },
    });
  } catch (err) {
    console.error('[API /posts POST]', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: process.env.NODE_ENV !== 'production' ? message : 'Failed to generate content' },
      { status: 500 },
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET — List posts
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const status = request.nextUrl.searchParams.get('status');
    const maxResults = parseInt(request.nextUrl.searchParams.get('limit') ?? '50', 10);

    let result;
    if (status === 'upcoming') {
      result = await PostService.getUpcoming(user.uid);
    } else if (status) {
      result = await PostService.getByStatus(user.uid, status as import('@/lib/linkedin/types').PostStatus);
    } else {
      result = await PostService.getAllByUser(user.uid, maxResults);
    }

    return NextResponse.json({ success: true, data: result.data });
  } catch (err) {
    console.error('[API /posts GET]', err);
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH — Status transitions (approve, reject, edit, retry, regenerate)
// ═══════════════════════════════════════════════════════════════════════════════

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { postId, action, editedContent } = body;

    if (!postId || !action) {
      return NextResponse.json(
        { error: 'Missing required fields: postId, action' },
        { status: 400 },
      );
    }

    // Verify ownership
    const postResult = await PostService.getById(postId);
    if (!postResult.data || postResult.data.userId !== user.uid) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const post = postResult.data;

    switch (action) {
      case 'approve':
        await PostService.approve(postId, editedContent);
        return NextResponse.json({ success: true, message: 'Post approved' });

      case 'reject':
        await PostService.reject(postId);
        return NextResponse.json({ success: true, message: 'Post rejected' });

      case 'edit':
        if (!editedContent) {
          return NextResponse.json({ error: 'editedContent required for edit action' }, { status: 400 });
        }
        await PostService.updateContent(postId, editedContent);
        return NextResponse.json({ success: true, message: 'Post updated' });

      case 'retry':
        await PostService.retry(postId);
        return NextResponse.json({ success: true, message: 'Post queued for retry' });

      case 'regenerate': {
        // Get profile for persona
        const profileResult = await ProfileService.get(user.uid);
        const profile = profileResult.data;

        const dayName = new Date(post.scheduledFor).toLocaleDateString('en-US', { weekday: 'long' });
        const newDraft = await regeneratePostDraft(
          {
            userId: user.uid,
            topic: post.topic,
            seriesTitle: undefined,
            previousPostSummary: post.previousPostSummary,
            persona: profile?.persona ?? undefined,
            publishDay: dayName,
            mediaType: post.mediaType,
          },
          post.content,
        );

        await PostService.updateContent(postId, newDraft.content);
        return NextResponse.json({
          success: true,
          message: 'Post regenerated',
          data: { content: newDraft.content },
        });
      }

      case 'publish': {
        // Instant publish to LinkedIn
        const pubProfileResult = await ProfileService.get(user.uid);
        const pubProfile = pubProfileResult.data;

        if (!pubProfile?.linkedinConnected || !pubProfile.linkedinAccessToken || !pubProfile.linkedinMemberUrn) {
          return NextResponse.json(
            { error: 'LinkedIn not connected. Go to Settings to connect your account.' },
            { status: 400 },
          );
        }

        // Check token expiry
        if (pubProfile.linkedinTokenExpiry && new Date(pubProfile.linkedinTokenExpiry) < new Date()) {
          return NextResponse.json(
            { error: 'LinkedIn token expired. Please reconnect in Settings.' },
            { status: 400 },
          );
        }

        const publishContent = editedContent ?? post.editedContent ?? post.content;

        try {
          const linkedinPostId = await createLinkedInPost({
            accessToken: pubProfile.linkedinAccessToken,
            authorUrn: pubProfile.linkedinMemberUrn,
            text: publishContent,
            mediaType: post.mediaType,
            mediaAssetUrn: post.linkedinMediaAsset ?? undefined,
          });

          await PostService.markPublished(postId, linkedinPostId);

          return NextResponse.json({
            success: true,
            message: 'Post published to LinkedIn!',
            data: { linkedinPostId },
          });
        } catch (pubErr: unknown) {
          const errMessage = pubErr instanceof Error ? pubErr.message : 'Unknown publish error';
          await PostService.markFailed(postId, errMessage);
          return NextResponse.json(
            { error: `Publish failed: ${errMessage}` },
            { status: 500 },
          );
        }
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 },
        );
    }
  } catch (err) {
    console.error('[API /posts PATCH]', err);
    return NextResponse.json({ error: 'Failed to update post' }, { status: 500 });
  }
}
