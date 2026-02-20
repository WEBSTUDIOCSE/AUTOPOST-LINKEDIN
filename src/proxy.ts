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
] as const;

const AUTH_ROUTES = [
  '/login',
  '/signup',
  '/forgot-password',
] as const;

// Constants for better performance
const LOGIN_URL = '/login';
const DEFAULT_REDIRECT = '/profile';

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
  
  // Redirect authenticated users from auth routes to profile
  if (isAuthRoute && isUserAuthenticated) {
    // Check if there's a redirect parameter
    const redirectParam = request.nextUrl.searchParams.get('redirect');
    const redirectUrl = new URL(
      redirectParam && !redirectParam.startsWith('/login') ? redirectParam : DEFAULT_REDIRECT,
      request.url
    );
    
    return NextResponse.redirect(redirectUrl);
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
