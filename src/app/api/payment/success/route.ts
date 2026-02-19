/**
 * API Route: Payment Success Handler
 * Handles PayU POST response for successful payments
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    // Get PayU response data
    const formData = await request.formData();
    
    const params = new URLSearchParams();
    
    // Convert FormData to URLSearchParams for the redirect
    formData.forEach((value, key) => {
      const stringValue = value.toString();
      params.append(key, stringValue);
    });
    
    // Validate request.url before using it
    if (!request.url || request.url === 'null' || request.url === 'undefined') {
      return new Response('Invalid request URL', { status: 400 });
    }
    
    // Extract the origin from the request URL for proper base URL construction
    const requestUrl = new URL(request.url);
    const origin = requestUrl.origin; // e.g., http://localhost:3000
    
    // Redirect to success page with parameters using proper HTTP redirect
    const redirectPath = `/payment/success?${params.toString()}`;
    
    try {
      const fullUrl = new URL(redirectPath, origin);
      
      // Use proper HTTP redirect with status 302 (temporary redirect)
      return NextResponse.redirect(fullUrl, { status: 302 });
    } catch (urlError) {
      return new Response('URL construction error', { status: 500 });
    }
    
  } catch (error) {
    try {
      if (request.url && request.url !== 'null' && request.url !== 'undefined') {
        const requestUrl = new URL(request.url);
        const fallbackUrl = new URL('/payment/failure?error=processing_failed', requestUrl.origin);
        return NextResponse.redirect(fallbackUrl, { status: 302 });
      } else {
        return new Response('Processing failed - invalid URL', { status: 500 });
      }
    } catch (fallbackError) {
      return new Response('Processing failed', { status: 500 });
    }
  }
}

// Also handle GET requests for direct access
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const { searchParams } = requestUrl;
  const redirectUrl = new URL(`/payment/success?${searchParams.toString()}`, requestUrl.origin);
  return NextResponse.redirect(redirectUrl);
}
