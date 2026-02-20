/**
 * Video Proxy Route — GET /api/ai/video-proxy
 *
 * Proxies Veo video downloads so the Google API key is NEVER exposed to the browser.
 * The client sends a video file ID; the server appends the API key and streams
 * the response back.
 *
 * Query params:
 *   fileId — The Gemini file ID (e.g. "3t12cime208q")
 *
 * Security:
 *   - Auth required
 *   - fileId validated (alphanumeric + hyphens only)
 *   - Response streamed (no buffering large videos in memory)
 *   - API key stays server-side
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/server';

/** Only allow alphanumeric, hyphens, and underscores in file IDs */
const FILE_ID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/;

/** Maximum video size we'll proxy (100 MB) */
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;

export async function GET(request: NextRequest) {
  // 1. Auth guard
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Extract and validate file ID
  const fileId = request.nextUrl.searchParams.get('fileId');
  if (!fileId || !FILE_ID_PATTERN.test(fileId)) {
    return NextResponse.json(
      { error: 'Invalid or missing fileId parameter' },
      { status: 400 },
    );
  }

  // 3. Build the authenticated Google API URL (key stays server-side)
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 },
    );
  }

  const googleUrl = new URL(
    `https://generativelanguage.googleapis.com/download/v1beta/files/${encodeURIComponent(fileId)}:download`,
  );
  googleUrl.searchParams.set('alt', 'media');
  googleUrl.searchParams.set('key', apiKey);

  // 4. Fetch from Google and stream to client
  try {
    const upstream = await fetch(googleUrl.toString(), {
      signal: AbortSignal.timeout(30_000), // 30s timeout for the upstream fetch
    });

    if (!upstream.ok) {
      // Map common Google errors to safe messages
      const status = upstream.status;
      if (status === 404) {
        return NextResponse.json({ error: 'Video not found or expired' }, { status: 404 });
      }
      if (status === 403) {
        return NextResponse.json({ error: 'Video access denied' }, { status: 403 });
      }
      return NextResponse.json(
        { error: 'Failed to fetch video from upstream' },
        { status: 502 },
      );
    }

    // Check content length to prevent abuse
    const contentLength = upstream.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_VIDEO_SIZE) {
      return NextResponse.json(
        { error: 'Video exceeds maximum allowed size' },
        { status: 413 },
      );
    }

    // Stream the response through
    return new NextResponse(upstream.body, {
      status: 200,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'video/mp4',
        ...(contentLength && { 'Content-Length': contentLength }),
        'Cache-Control': 'private, max-age=3600', // Cache for 1h per user
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      return NextResponse.json({ error: 'Upstream video fetch timed out' }, { status: 504 });
    }
    return NextResponse.json({ error: 'Failed to proxy video' }, { status: 502 });
  }
}
