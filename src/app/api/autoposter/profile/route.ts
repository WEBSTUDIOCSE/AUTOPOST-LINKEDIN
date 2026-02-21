/**
 * Autoposter Profile API
 *
 * GET   /api/autoposter/profile — get profile
 * POST  /api/autoposter/profile — create/init profile
 * PATCH /api/autoposter/profile — update profile fields
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/server';
import { ProfileService } from '@/lib/linkedin/services/profile.service';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await ProfileService.get(user.uid);
    return NextResponse.json({ success: true, data: result.data });
  } catch (err) {
    console.error('[API /autoposter/profile GET]', err);
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }
}

export async function POST() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if profile already exists
    const existing = await ProfileService.get(user.uid);
    if (existing.data) {
      return NextResponse.json({ success: true, message: 'Profile already exists', data: existing.data });
    }

    await ProfileService.create(user.uid);
    return NextResponse.json({ success: true, message: 'Profile created' }, { status: 201 });
  } catch (err) {
    console.error('[API /autoposter/profile POST]', err);
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Only allow updating specific fields — prevent token injection
    const allowedFields = [
      'persona', 'postingSchedule', 'timezone',
      'draftGenerationHour', 'reviewDeadlineHour', 'fcmToken',
    ];

    const updates: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (key in body) {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    await ProfileService.update(user.uid, updates);
    return NextResponse.json({ success: true, message: 'Profile updated' });
  } catch (err) {
    console.error('[API /autoposter/profile PATCH]', err);
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
  }
}
