/**
 * Template Management API
 *
 * POST   /api/templates — create a new HTML template
 * GET    /api/templates — list all user's templates
 * PATCH  /api/templates — update a template
 * DELETE /api/templates — delete a template
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/server';
import { TemplateService } from '@/lib/linkedin/services/template.service';

// ═══════════════════════════════════════════════════════════════════════════════
// POST — Create template
// ═══════════════════════════════════════════════════════════════════════════════

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, description, htmlContent, dimensions } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Template name is required' }, { status: 400 });
    }
    if (!htmlContent?.trim()) {
      return NextResponse.json({ error: 'HTML content is required' }, { status: 400 });
    }

    // Basic validation: must contain HTML
    if (!htmlContent.includes('<html') && !htmlContent.includes('<!DOCTYPE')) {
      return NextResponse.json({ error: 'Content must be valid HTML' }, { status: 400 });
    }

    const result = await TemplateService.create(user.uid, {
      name: name.trim(),
      description: description?.trim() || undefined,
      htmlContent: htmlContent.trim(),
      dimensions: dimensions ?? undefined,
    });

    return NextResponse.json({ success: true, data: { templateId: result.data } });
  } catch (err) {
    console.error('[API /templates POST]', err);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET — List templates
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await TemplateService.getAllByUser(user.uid);
    return NextResponse.json({ success: true, data: result.data });
  } catch (err) {
    console.error('[API /templates GET]', err);
    return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH — Update template
// ═══════════════════════════════════════════════════════════════════════════════

export async function PATCH(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { templateId, ...updates } = body;

    if (!templateId) {
      return NextResponse.json({ error: 'Missing templateId' }, { status: 400 });
    }

    // Verify ownership
    const templateResult = await TemplateService.getById(templateId);
    if (!templateResult.data || templateResult.data.userId !== user.uid) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Clean up update fields
    const cleanUpdates: Record<string, unknown> = {};
    if (updates.name?.trim()) cleanUpdates.name = updates.name.trim();
    if (updates.description !== undefined) cleanUpdates.description = updates.description?.trim() || null;
    if (updates.htmlContent?.trim()) cleanUpdates.htmlContent = updates.htmlContent.trim();
    if (updates.dimensions) cleanUpdates.dimensions = updates.dimensions;

    await TemplateService.update(templateId, cleanUpdates);
    return NextResponse.json({ success: true, message: 'Template updated' });
  } catch (err) {
    console.error('[API /templates PATCH]', err);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE — Delete template
// ═══════════════════════════════════════════════════════════════════════════════

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const templateId = searchParams.get('id');

    if (!templateId) {
      return NextResponse.json({ error: 'Missing id parameter' }, { status: 400 });
    }

    // Verify ownership
    const templateResult = await TemplateService.getById(templateId);
    if (!templateResult.data || templateResult.data.userId !== user.uid) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    await TemplateService.delete(templateId);
    return NextResponse.json({ success: true, message: 'Template deleted' });
  } catch (err) {
    console.error('[API /templates DELETE]', err);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
