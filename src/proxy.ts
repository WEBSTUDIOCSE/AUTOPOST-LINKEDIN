/**
 * Next.js 16 Proxy for Route Protection
 * Replaces middleware.ts - handles authentication checks before pages render
 * Updated to follow Next.js 16 conventions
 */

import { NextRequest, NextResponse } from 'next/server';

// Define route groups - Next.js 16 optimized
const PROTECTED_ROUTES = [
  '/profile',
  '/delete-account',
  '/change-password',
  '/checkout',
  '/payment',
  '/ai-test',
  '/dashboard',
  '/series',
  '/templates',
  '/ideas',
  '/settings',
] as const;

const AUTH_ROUTES = [
  '/login',
  '/signup',
  '/forgot-password',
] as const;

// Constants for better performance
const LOGIN_URL = '/login';
const DEFAULT_REDIRECT = '/dashboard';

/**
 * Sanitise the ?redirect= parameter to prevent open-redirect attacks.
 *
 * Only relative paths that begin with a single '/' are allowed.
 * Protocol-relative URLs (//evil.com), absolute URLs, and empty values
 * all fall back to the DEFAULT_REDIRECT.
 */
function sanitizeRedirect(redirect: string | null): string {
  if (!redirect) return DEFAULT_REDIRECT;
  // Must start with '/' but NOT with '//' (protocol-relative URL)
  if (redirect.startsWith('/') && !redirect.startsWith('//')) {
    return redirect;
  }
  return DEFAULT_REDIRECT;
}

/**
 * Check if user is authenticated based on cookies.
 * Only the httpOnly firebaseAuthToken cookie is used — the server
 * verifies it cryptographically via Firebase Admin SDK on every request.
 */
function isAuthenticated(request: NextRequest): boolean {
  const authToken = request.cookies.get('firebaseAuthToken');
  return !!authToken?.value;
}

/**
 * Check if the path starts with any of the route patterns
 */
function matchesRoutePattern(pathname: string, routes: readonly string[]): boolean {
  return routes.some(route => pathname.startsWith(route));
}

/**
 * Main proxy function - Next.js 16 optimized
 * Renamed from middleware to proxy per Next.js 16 convention
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  
  // Skip proxy for static assets and API routes (redundant with matcher but faster)
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }
  
  const isUserAuthenticated = isAuthenticated(request);
  const isProtectedRoute = matchesRoutePattern(pathname, PROTECTED_ROUTES);
  const isAuthRoute = matchesRoutePattern(pathname, AUTH_ROUTES);
  
  // Redirect unauthenticated users from protected routes to login
  if (isProtectedRoute && !isUserAuthenticated) {
    const loginUrl = new URL(LOGIN_URL, request.url);
    loginUrl.searchParams.set('redirect', pathname + search);
    loginUrl.searchParams.set('message', 'Please sign in to continue');
    
    return NextResponse.redirect(loginUrl);
  }
  
  // If the server flagged the token as expired, clear the stale cookie and
  // let the user reach the login page rather than bouncing them back.
  const isExpiredFlag = request.nextUrl.searchParams.get('expired') === '1';
  if (isAuthRoute && isUserAuthenticated && !isExpiredFlag) {
    const redirectParam = request.nextUrl.searchParams.get('redirect');
    const safePath = sanitizeRedirect(redirectParam);
    const redirectUrl = new URL(safePath, request.url);
    return NextResponse.redirect(redirectUrl);
  }

  // Clear the stale cookie so the login page starts fresh.
  if (isAuthRoute && isUserAuthenticated && isExpiredFlag) {
    const response = NextResponse.next();
    response.cookies.delete('firebaseAuthToken');
    return response;
  }
  
  // Continue to the requested page
  return NextResponse.next();
}

/**
 * Next.js 16 Proxy Config
 * Optimized matcher for better performance
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api routes (handled separately)
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - _next/webpack-hmr (hot reload)
     * - favicon.ico, robots.txt, sitemap.xml
     * - manifest.json (PWA manifest)
     * - public files (images, fonts, etc.)
     */
    '/((?!api/|_next/static|_next/image|_next/webpack-hmr|favicon.ico|robots.txt|sitemap.xml|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|eot)).*)',
  ],
};
