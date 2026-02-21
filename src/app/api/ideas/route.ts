/**
 * Ideas Bank API
 *
 * POST   /api/ideas — add a new idea
 * GET    /api/ideas — list ideas
 * PATCH  /api/ideas — update an idea
 * DELETE /api/ideas — delete an idea
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/server';
import { IdeaService } from '@/lib/linkedin/services/idea.service';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { text, seriesId } = body;

    if (!text?.trim()) {
      return NextResponse.json({ error: 'Idea text is required' }, { status: 400 });
    }

    const result = await IdeaService.create(user.uid, { text: text.trim(), seriesId });
    return NextResponse.json({ success: true, data: { ideaId: result.data } });
  } catch (err) {
    console.error('[API /ideas POST]', err);
    return NextResponse.json({ error: 'Failed to create idea' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await IdeaService.getAllByUser(user.uid);
    return NextResponse.json({ success: true, data: result.data });
  } catch (err) {
    console.error('[API /ideas GET]', err);
    return NextResponse.json({ error: 'Failed to fetch ideas' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { ideaId, text } = body;

    if (!ideaId || !text?.trim()) {
      return NextResponse.json({ error: 'ideaId and text are required' }, { status: 400 });
    }

    await IdeaService.update(ideaId, text.trim());
    return NextResponse.json({ success: true, message: 'Idea updated' });
  } catch (err) {
    console.error('[API /ideas PATCH]', err);
    return NextResponse.json({ error: 'Failed to update idea' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ideaId = request.nextUrl.searchParams.get('id');
    if (!ideaId) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }

    await IdeaService.delete(ideaId);
    return NextResponse.json({ success: true, message: 'Idea deleted' });
  } catch (err) {
    console.error('[API /ideas DELETE]', err);
    return NextResponse.json({ error: 'Failed to delete idea' }, { status: 500 });
  }
}
