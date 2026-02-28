/**
 * Post Management API
 *
 * POST  /api/posts — generate AI content (instant or scheduled mode)
 * GET   /api/posts — list user's posts
 * PATCH /api/posts — approve / reject / edit / retry / regenerate / publish
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/server';

// Multi-page carousel: up to 90s per page × 3 retries × N pages — allow 5 min
export const maxDuration = 300; // seconds
import { PostService } from '@/lib/linkedin/services/post.service';
import { SeriesService } from '@/lib/linkedin/services/series.service';
import { IdeaService } from '@/lib/linkedin/services/idea.service';
import { ProfileService } from '@/lib/linkedin/services/profile.service';
import { TemplateService } from '@/lib/linkedin/services/template.service';
import { generatePostDraft, regeneratePostDraft } from '@/lib/linkedin/services/post-generator.service';
import { sendPushNotification } from '@/lib/linkedin/services/push.service';
import {
  createLinkedInPost,
  uploadImageToLinkedIn,
  uploadVideoToLinkedIn,
  downloadMediaAsBuffer,
} from '@/lib/linkedin/linkedin-oauth';
import { uploadMediaToStorage } from '@/lib/firebase/services/media-storage.service';
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
//   mediaType: 'text' | 'image' | 'video' | 'html'  (default 'text')
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

    // ── Validate page count (HTML carousel) ──────────────────────────────────

    const pageCount = typeof body.pageCount === 'number'
      ? Math.max(1, Math.min(9, Math.floor(body.pageCount)))
      : 1;

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

    // ── Resolve template (if HTML mediaType with templateId) ────────────────

    const templateId = typeof body.templateId === 'string' ? body.templateId.trim() : undefined;
    let templateHtml: string | undefined;
    let templateDimensions: { width: number; height?: number } | undefined;

    if (templateId && mediaType === 'html') {
      const tplResult = await TemplateService.getById(templateId);
      if (tplResult.data && tplResult.data.userId === user.uid) {
        templateHtml = tplResult.data.htmlContent;
        templateDimensions = tplResult.data.dimensions;
      }
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
      // Template
      templateId,
      templateHtml,
      templateDimensions,
      // Page count (HTML carousel)
      pageCount,
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
      htmlContent: draft.htmlContent,
      pageCount,
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
        htmlContent: draft.htmlContent,
        pageCount,
        mediaType,
        mode,
        ...(draft.mediaGenerationError && { mediaWarning: draft.mediaGenerationError }),
      },
    });
  } catch (err) {
    console.error('[API /posts POST]', err);
    // Always show a clean error — AIAdapterError messages are already sanitized
    const message = err instanceof Error ? err.message : String(err);
    // Strip the [provider] prefix for cleaner display (e.g. "[gemini] ..." → "...")
    const cleanMessage = message.replace(/^\[\w+\]\s*/, '');
    return NextResponse.json(
      { error: cleanMessage || 'Failed to generate content' },
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
// DELETE — Permanently remove a post
// ═══════════════════════════════════════════════════════════════════════════════

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const postId = request.nextUrl.searchParams.get('postId');
    if (!postId) {
      return NextResponse.json({ error: 'Missing required query param: postId' }, { status: 400 });
    }

    // Verify ownership
    const postResult = await PostService.getById(postId);
    if (!postResult.data || postResult.data.userId !== user.uid) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    await PostService.deletePost(postId);
    return NextResponse.json({ success: true, message: 'Post deleted' });
  } catch (err) {
    console.error('[API /posts DELETE]', err);
    return NextResponse.json({ error: 'Failed to delete post' }, { status: 500 });
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
    const { postId, action, editedContent, imageBase64, imageBase64Array, slideIndex } = body;

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
      case 'approve': {
        await PostService.approve(postId, editedContent);

        // If the client captured HTML→PNG images, upload them to Storage
        // and persist the URLs so the scheduled Firebase Function can publish
        // without needing a browser for HTML→PNG conversion.
        if (post.mediaType === 'html') {
          const pages = imageBase64Array ?? (imageBase64 ? [imageBase64] : []);
          if (pages.length > 0) {
            const urls: string[] = [];
            for (const b64 of pages) {
              const url = await uploadMediaToStorage({
                base64: b64,
                mimeType: 'image/png',
                folder: 'posts/images',
                userId: user.uid,
              });
              urls.push(url);
            }
            await PostService.setImageUrls(postId, urls);
          }
        }

        return NextResponse.json({ success: true, message: 'Post approved' });
      }

      case 'reject': {
        // Reset the post back to 'scheduled' so generate-all will re-generate
        // with the same topic at the next draft hour. Series index is NOT advanced.
        await PostService.reject(postId);

        // Clear old content so generate-all treats it as a fresh scheduled post
        const { getAdminDb: getDb } = await import('@/lib/firebase/admin');
        const { POSTS_COLLECTION: PC } = await import('@/lib/linkedin/collections');
        const { FieldValue: FV } = await import('firebase-admin/firestore');
        await getDb().collection(PC).doc(postId).update({
          status: 'scheduled',
          content: '',
          editedContent: null,
          htmlContent: null,
          mediaUrl: null,
          mediaMimeType: null,
          imageUrls: null,
          linkedinMediaAsset: null,
          updatedAt: FV.serverTimestamp(),
        });

        return NextResponse.json({ success: true, message: 'Post rejected — will be regenerated at next draft hour' });
      }

      case 'edit':
        if (!editedContent) {
          return NextResponse.json({ error: 'editedContent required for edit action' }, { status: 400 });
        }
        await PostService.updateContent(postId, editedContent);
        return NextResponse.json({ success: true, message: 'Post updated' });

      case 'remove-slide': {
        // Remove a specific slide from a multi-page HTML carousel
        if (typeof slideIndex !== 'number') {
          return NextResponse.json({ error: 'slideIndex required' }, { status: 400 });
        }
        if (!post.htmlContent || !post.pageCount || post.pageCount <= 1) {
          return NextResponse.json({ error: 'Post is not a multi-page carousel' }, { status: 400 });
        }
        const { removeSlideFromHtml } = await import('@/lib/html-gen/utils');
        const result = removeSlideFromHtml(post.htmlContent, slideIndex, post.pageCount);
        if (!result) {
          return NextResponse.json({ error: 'Could not remove slide' }, { status: 400 });
        }
        await PostService.updateHtml(postId, result.html, result.newPageCount);
        return NextResponse.json({
          success: true,
          message: 'Slide removed',
          data: { htmlContent: result.html, pageCount: result.newPageCount },
        });
      }

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

        await PostService.updateContent(postId, newDraft.content, newDraft.htmlContent);

        return NextResponse.json({
          success: true,
          message: 'Post regenerated',
          data: { content: newDraft.content, htmlContent: newDraft.htmlContent },
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
          // ── HTML posts: multi-page carousel or single image ────────────────
          let mediaAssetUrns: string[] | undefined;

          if (post.mediaType === 'html' && imageBase64Array && Array.isArray(imageBase64Array) && imageBase64Array.length > 0) {
            // Client sent freshly-captured pages (Post Now flow)
            const urns: string[] = [];
            for (const b64 of imageBase64Array) {
              const mediaUrl = await uploadMediaToStorage({
                base64: b64,
                mimeType: 'image/png',
                folder: 'posts/images',
                userId: user.uid,
              });
              const mediaBuffer = await downloadMediaAsBuffer(mediaUrl);
              const { imageUrn } = await uploadImageToLinkedIn(
                pubProfile.linkedinAccessToken,
                pubProfile.linkedinMemberUrn,
                mediaBuffer,
              );
              urns.push(imageUrn);
            }
            mediaAssetUrns = urns;
          } else if (post.mediaType === 'html' && post.imageUrls && post.imageUrls.length > 0) {
            // Pre-captured images stored at approval time — used by scheduled publish
            const urns: string[] = [];
            for (const storedUrl of post.imageUrls) {
              const mediaBuffer = await downloadMediaAsBuffer(storedUrl);
              const { imageUrn } = await uploadImageToLinkedIn(
                pubProfile.linkedinAccessToken,
                pubProfile.linkedinMemberUrn,
                mediaBuffer,
              );
              urns.push(imageUrn);
            }
            mediaAssetUrns = urns;
          } else if (post.mediaType === 'html' && imageBase64 && !post.mediaUrl) {
            // Single-page fallback
            const mediaUrl = await uploadMediaToStorage({
              base64: imageBase64,
              mimeType: 'image/png',
              folder: 'posts/images',
              userId: user.uid,
            });
            await PostService.setMediaUrl(post.id, mediaUrl, 'image/png');
            post.mediaUrl = mediaUrl;
          }

          // If post has a media URL (stored in Firebase Storage) but no LinkedIn
          // asset URN yet, upload the media to LinkedIn now and get the URN.
          let mediaAssetUrn = post.linkedinMediaAsset ?? undefined;

          if (!mediaAssetUrns && !mediaAssetUrn && post.mediaUrl && post.mediaType !== 'text') {
            const mediaBuffer = await downloadMediaAsBuffer(post.mediaUrl);

            if (post.mediaType === 'image' || post.mediaType === 'html') {
              const { imageUrn } = await uploadImageToLinkedIn(
                pubProfile.linkedinAccessToken,
                pubProfile.linkedinMemberUrn,
                mediaBuffer,
              );
              mediaAssetUrn = imageUrn;
            } else if (post.mediaType === 'video') {
              const { videoUrn } = await uploadVideoToLinkedIn(
                pubProfile.linkedinAccessToken,
                pubProfile.linkedinMemberUrn,
                mediaBuffer,
              );
              mediaAssetUrn = videoUrn;
            }

            // Cache the LinkedIn asset URN on the post so re-publishes skip re-upload
            if (mediaAssetUrn) {
              await PostService.setLinkedinMediaAsset(post.id, mediaAssetUrn);
            }
          }

          const linkedinPostId = await createLinkedInPost({
            accessToken: pubProfile.linkedinAccessToken,
            authorUrn: pubProfile.linkedinMemberUrn,
            text: publishContent,
            mediaType: post.mediaType,
            mediaAssetUrn: mediaAssetUrns ? mediaAssetUrns[0] : mediaAssetUrn,
            mediaAssetUrns,
          });

          await PostService.markPublished(postId, linkedinPostId);

          // Notify user of successful publish
          sendPushNotification(user.uid, {
            type: 'post_published',
            title: '🚀 Post Published!',
            body: `"${post.topic}" is now live on LinkedIn.`,
            postId,
            clickAction: '/posts',
          }).catch(() => {});

          // Advance series topic index so the next generation picks the next topic
          if (post.seriesId && post.topicIndex !== undefined) {
            const seriesResult = await SeriesService.getById(post.seriesId);
            if (seriesResult.data) {
              await SeriesService.advanceIndex(
                post.seriesId,
                seriesResult.data.topicQueue.length,
                seriesResult.data.currentIndex,
              );
            }
          }

          return NextResponse.json({
            success: true,
            message: 'Post published to LinkedIn!',
            data: { linkedinPostId },
          });
        } catch (pubErr: unknown) {
          const errMessage = pubErr instanceof Error ? pubErr.message : 'Unknown publish error';
          await PostService.markFailed(postId, errMessage);

          // Notify user of publish failure
          sendPushNotification(user.uid, {
            type: 'post_failed',
            title: '❌ Publish Failed',
            body: `Failed to publish "${post.topic}": ${errMessage.slice(0, 100)}`,
            postId,
            clickAction: '/posts',
          }).catch(() => {});

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
