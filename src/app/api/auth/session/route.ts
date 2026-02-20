/**
 * API Route: Set/Clear Authentication Session Cookie
 *
 * Security:
 *   - CSRF protection via Origin / Referer header check
 *   - Token is verified server-side with Firebase Admin SDK before setting cookie
 *   - Only the raw ID token is stored (no userData cookie)
 *   - server.ts re-verifies the token on every request via getCurrentUser()
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminAuth } from '@/lib/firebase/admin';
import { AUTH_TOKEN_COOKIE, AUTH_COOKIE_OPTIONS } from '@/lib/auth/server';

// ─── CSRF Helpers ────────────────────────────────────────────────────────────

/**
 * Validate that the request originates from our own site.
 * Checks the Origin header first (preferred), then falls back to Referer.
 * In development, localhost origins are allowed.
 */
function isValidOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  // At least one of the two headers must be present
  const source = origin || (referer ? new URL(referer).origin : null);
  if (!source) return false;

  // In production the origin must match the deployment URL
  const allowedOrigins = new Set<string>();

  if (process.env.NEXT_PUBLIC_APP_URL) {
    allowedOrigins.add(new URL(process.env.NEXT_PUBLIC_APP_URL).origin);
  }

  // Always allow the request's own host (covers Vercel preview deploys, etc.)
  const requestOrigin = new URL(request.url).origin;
  allowedOrigins.add(requestOrigin);

  // Dev convenience
  if (process.env.NODE_ENV !== 'production') {
    allowedOrigins.add('http://localhost:3000');
    allowedOrigins.add('http://127.0.0.1:3000');
  }

  return allowedOrigins.has(source);
}

// ─── POST: Create Session ────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    // 1. CSRF check
    if (!isValidOrigin(request)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // 2. Parse body
    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    // 3. Verify the token with Firebase Admin SDK
    //    This ensures we never store an untrusted / forged token.
    try {
      await getAdminAuth().verifyIdToken(token, /* checkRevoked */ true);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // 4. Set the verified token as an httpOnly cookie
    const cookieStore = await cookies();
    cookieStore.set(AUTH_TOKEN_COOKIE, token, AUTH_COOKIE_OPTIONS);

    return NextResponse.json({ success: true });
  } catch {
    console.warn('[Session] Failed to create session');
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// ─── DELETE: Clear Session ───────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  try {
    // CSRF check
    if (!isValidOrigin(request)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const cookieStore = await cookies();
    cookieStore.delete(AUTH_TOKEN_COOKIE);

    // Clean up legacy userData cookie if it still exists
    cookieStore.delete('userData');

    return NextResponse.json({ success: true });
  } catch {
    console.warn('[Session] Failed to clear session');
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
