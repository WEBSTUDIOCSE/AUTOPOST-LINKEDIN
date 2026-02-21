/**
 * LinkedIn OAuth — Callback
 *
 * GET /api/linkedin/callback?code=...&state=...
 *
 * LinkedIn redirects here after the user grants permission.
 * We verify the state, exchange the code for tokens, fetch the user's
 * profile, and store everything in Firestore.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/lib/auth/server';
import { exchangeCodeForTokens, getLinkedInProfile } from '@/lib/linkedin/linkedin-oauth';
import { ProfileService } from '@/lib/linkedin/services/profile.service';

const STATE_COOKIE = 'linkedin_oauth_state';

export async function GET(request: NextRequest) {
  try {
    // 1. Must be authenticated
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // 2. Extract params
    const code = request.nextUrl.searchParams.get('code');
    const state = request.nextUrl.searchParams.get('state');
    const error = request.nextUrl.searchParams.get('error');

    if (error) {
      console.error('[LinkedIn OAuth] Error from LinkedIn:', error);
      return NextResponse.redirect(
        new URL('/dashboard?linkedin=error&reason=' + encodeURIComponent(error), request.url),
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL('/dashboard?linkedin=error&reason=missing_params', request.url),
      );
    }

    // 3. Verify CSRF state
    const cookieStore = await cookies();
    const storedState = cookieStore.get(STATE_COOKIE)?.value;
    cookieStore.delete(STATE_COOKIE);

    if (!storedState || storedState !== state) {
      return NextResponse.redirect(
        new URL('/dashboard?linkedin=error&reason=state_mismatch', request.url),
      );
    }

    // 4. Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // 5. Fetch LinkedIn profile (we need the member URN for posting)
    const profile = await getLinkedInProfile(tokens.accessToken);

    // 6. Store in Firestore
    await ProfileService.setLinkedInTokens(user.uid, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: tokens.expiresIn,
      memberUrn: `urn:li:person:${profile.sub}`,
    });

    // 7. Redirect to dashboard with success indicator
    return NextResponse.redirect(
      new URL('/dashboard?linkedin=connected', request.url),
    );
  } catch (err) {
    console.error('[LinkedIn OAuth] Callback error:', err);
    return NextResponse.redirect(
      new URL('/dashboard?linkedin=error&reason=token_exchange_failed', request.url),
    );
  }
}
