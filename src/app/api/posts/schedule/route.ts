/**
 * Schedule Posts API — create placeholder posts (no AI generation)
 *
 * POST /api/posts/schedule
 *
 * Creates one or more "scheduled" placeholder posts. AI drafts will be
 * generated later by the Firebase `generateDrafts` function at the user's
 * configured draftGenerationHour (the night before the posting day).
 *
 * Body: { posts: Array<{ topic, notes?, scheduledFor, reviewDeadline,
 *         seriesId?, topicIndex?, mediaType?, templateId?, pageCount?,
 *         provider?, textModel? }> }
 *
 * Returns: { success: true, created: number, ids: string[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/server';
import { PostService } from '@/lib/linkedin/services/post.service';
import type { PostMediaType } from '@/lib/linkedin/types';

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const posts: unknown[] = Array.isArray(body.posts) ? body.posts : [];

    if (posts.length === 0) {
      return NextResponse.json(
        { error: 'At least one post is required in the posts array' },
        { status: 400 },
      );
    }

    if (posts.length > 20) {
      return NextResponse.json(
        { error: 'Maximum 20 posts per batch' },
        { status: 400 },
      );
    }

    const ids: string[] = [];

    for (const raw of posts) {
      const p = raw as Record<string, unknown>;

      const topic = typeof p.topic === 'string' ? p.topic.trim() : '';
      if (!topic) continue;

      const scheduledFor = p.scheduledFor ? new Date(p.scheduledFor as string) : null;
      const reviewDeadline = p.reviewDeadline ? new Date(p.reviewDeadline as string) : null;
      if (!scheduledFor || !reviewDeadline) continue;

      const mediaType = (['text', 'image', 'video', 'html'].includes(p.mediaType as string)
        ? p.mediaType : 'text') as PostMediaType;

      const pageCount = typeof p.pageCount === 'number'
        ? Math.max(1, Math.min(9, Math.floor(p.pageCount)))
        : 1;

      const result = await PostService.createScheduled({
        userId: user.uid,
        topic,
        notes: typeof p.notes === 'string' ? p.notes.trim() || undefined : undefined,
        scheduledFor,
        reviewDeadline,
        seriesId: typeof p.seriesId === 'string' ? p.seriesId : undefined,
        topicIndex: typeof p.topicIndex === 'number' ? p.topicIndex : undefined,
        mediaType,
        templateId: typeof p.templateId === 'string' ? p.templateId : undefined,
        pageCount,
        provider: typeof p.provider === 'string' ? p.provider : undefined,
        textModel: typeof p.textModel === 'string' ? p.textModel : undefined,
        pageInstructions: Array.isArray(p.pageInstructions) ? (p.pageInstructions as string[]).filter(s => typeof s === 'string' && s.trim()) : undefined,
      });

      if (result.data) ids.push(result.data);
    }

    return NextResponse.json({ success: true, created: ids.length, ids });
  } catch (err) {
    console.error('[API /posts/schedule]', err);
    return NextResponse.json(
      { error: 'Internal error', details: String(err) },
      { status: 500 },
    );
  }
}
