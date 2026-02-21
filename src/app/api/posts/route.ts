/**
 * Post Management API
 *
 * POST /api/posts            — generate a new draft (manual trigger)
 * GET  /api/posts            — list user's posts
 * PATCH /api/posts           — approve / reject / edit / retry a post
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/server';
import { PostService } from '@/lib/linkedin/services/post.service';
import { SeriesService } from '@/lib/linkedin/services/series.service';
import { IdeaService } from '@/lib/linkedin/services/idea.service';
import { ProfileService } from '@/lib/linkedin/services/profile.service';
import { generatePostDraft, regeneratePostDraft } from '@/lib/linkedin/services/post-generator.service';

// ═══════════════════════════════════════════════════════════════════════════════
// POST — Generate a new draft (manual trigger from the UI)
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { topic, notes, seriesId, scheduledFor, reviewDeadline } = body;

    if (!topic || !scheduledFor || !reviewDeadline) {
      return NextResponse.json(
        { error: 'Missing required fields: topic, scheduledFor, reviewDeadline' },
        { status: 400 },
      );
    }

    // Get profile for persona
    const profileResult = await ProfileService.get(user.uid);
    const profile = profileResult.data;

    // Get series context if applicable
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

    // Generate draft with AI
    const dayName = new Date(scheduledFor).toLocaleDateString('en-US', { weekday: 'long' });
    const draft = await generatePostDraft({
      topic,
      notes,
      seriesTitle,
      previousPostSummary,
      persona: profile?.persona ?? undefined,
      publishDay: dayName,
    });

    // Save to Firestore
    const result = await PostService.create({
      userId: user.uid,
      topic,
      content: draft.content,
      scheduledFor: new Date(scheduledFor),
      reviewDeadline: new Date(reviewDeadline),
      seriesId,
      topicIndex,
      previousPostSummary: draft.summary,
      inputPrompt: `Topic: ${topic}${notes ? `\nNotes: ${notes}` : ''}`,
    });

    return NextResponse.json({
      success: true,
      data: { postId: result.data, content: draft.content, summary: draft.summary },
    });
  } catch (err) {
    console.error('[API /posts POST]', err);
    return NextResponse.json({ error: 'Failed to generate draft' }, { status: 500 });
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
            topic: post.topic,
            seriesTitle: undefined,
            previousPostSummary: post.previousPostSummary,
            persona: profile?.persona ?? undefined,
            publishDay: dayName,
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
