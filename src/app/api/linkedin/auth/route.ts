/**
 * LinkedIn OAuth — Initiate
 *
 * GET /api/linkedin/auth
 *
 * Redirects the browser to LinkedIn's OAuth consent page.
 * Stores a CSRF `state` token in a httpOnly cookie so we can verify
 * it in the callback.
 */

import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getLinkedInAuthUrl } from '@/lib/linkedin/linkedin-oauth';
import { getCurrentUser } from '@/lib/auth/server';

const STATE_COOKIE = 'linkedin_oauth_state';

export async function GET() {
  // Must be authenticated
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Generate a random state parameter for CSRF protection
  const state = crypto.randomUUID();

  // Store state in httpOnly cookie (expires in 10 minutes)
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 10 * 60,
  });

  const authUrl = getLinkedInAuthUrl(state);
  return NextResponse.redirect(authUrl);
}
