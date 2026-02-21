/**
 * Series Management API
 *
 * POST   /api/series — create a new series
 * GET    /api/series — list all user's series
 * PATCH  /api/series — update a series
 * DELETE /api/series — delete a series
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/server';
import { SeriesService } from '@/lib/linkedin/services/series.service';

// ═══════════════════════════════════════════════════════════════════════════════
// POST — Create series
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { title, category, topicQueue, order } = body;

    if (!title || !category || !topicQueue?.length) {
      return NextResponse.json(
        { error: 'Missing required fields: title, category, topicQueue (non-empty array)' },
        { status: 400 },
      );
    }

    const result = await SeriesService.create(user.uid, {
      title,
      category,
      topicQueue,
      order,
    });

    return NextResponse.json({ success: true, data: { seriesId: result.data } });
  } catch (err) {
    console.error('[API /series POST]', err);
    return NextResponse.json({ error: 'Failed to create series' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET — List series
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await SeriesService.getAllByUser(user.uid);
    return NextResponse.json({ success: true, data: result.data });
  } catch (err) {
    console.error('[API /series GET]', err);
    return NextResponse.json({ error: 'Failed to fetch series' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH — Update series
// ═══════════════════════════════════════════════════════════════════════════════

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { seriesId, ...updates } = body;

    if (!seriesId) {
      return NextResponse.json({ error: 'Missing seriesId' }, { status: 400 });
    }

    // Verify ownership
    const seriesResult = await SeriesService.getById(seriesId);
    if (!seriesResult.data || seriesResult.data.userId !== user.uid) {
      return NextResponse.json({ error: 'Series not found' }, { status: 404 });
    }

    await SeriesService.update(seriesId, updates);
    return NextResponse.json({ success: true, message: 'Series updated' });
  } catch (err) {
    console.error('[API /series PATCH]', err);
    return NextResponse.json({ error: 'Failed to update series' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE — Delete series
// ═══════════════════════════════════════════════════════════════════════════════

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const seriesId = searchParams.get('id');

    if (!seriesId) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }

    // Verify ownership
    const seriesResult = await SeriesService.getById(seriesId);
    if (!seriesResult.data || seriesResult.data.userId !== user.uid) {
      return NextResponse.json({ error: 'Series not found' }, { status: 404 });
    }

    await SeriesService.delete(seriesId);
    return NextResponse.json({ success: true, message: 'Series deleted' });
  } catch (err) {
    console.error('[API /series DELETE]', err);
    return NextResponse.json({ error: 'Failed to delete series' }, { status: 500 });
  }
}
