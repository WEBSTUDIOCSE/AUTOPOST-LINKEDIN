import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

/**
 * Next.js 15 Configuration
 * Updated with latest best practices
 */
const nextConfig: NextConfig = {
  // Enable React strict mode for better error detection
  reactStrictMode: true,
  
  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.googleusercontent.com',
      },
    ],
  },
  
  // Experimental features
  experimental: {
    optimizeCss: true,
    // Enable React Taint APIs — prevents accidental leakage of sensitive
    // server-only values (tokens, secrets) into client components.
    taint: true,
  },

  // Never reveal the technology stack via the X-Powered-By header
  poweredByHeader: false,

  // ── Security Headers ──────────────────────────────────────────────────────
  async headers() {
    const isDev = process.env.NODE_ENV === 'development';

    // Content-Security-Policy — restrict resource origins to prevent XSS.
    // Adjust the directives below to match any additional third-party domains
    // your app uses (e.g. analytics scripts, CDN fonts).
    const cspDirectives = [
      "default-src 'self'",
      // Scripts: allow self + Google (reCAPTCHA / Firebase App Check)
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''} https://www.google.com https://www.gstatic.com`,
      // Styles: inline required for Tailwind CSS + Radix UI
      "style-src 'self' 'unsafe-inline'",
      // Images: self, data URIs and any https source (avatars, OG images)
      "img-src 'self' data: https:",
      // Fonts: only from the app itself (next/font self-hosts at build time)
      "font-src 'self'",
      // Connections: Firebase, Google APIs, Firestore, Identity Toolkit
      "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com wss://*.firebaseio.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://firestore.googleapis.com",
      // Frames: Google (reCAPTCHA)
      "frame-src https://www.google.com",
      // Form submissions: self + PayU (both test and production)
      "form-action 'self' https://secure.payu.in https://test.payu.in",
      // Prevent <object>/<embed> — common XSS vector
      "object-src 'none'",
      // Restrict <base> tag to prevent base-tag hijacking
      "base-uri 'self'",
      // Upgrade insecure requests in production
      ...(isDev ? [] : ["upgrade-insecure-requests"]),
    ].join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          // XSS protection via resource whitelisting
          { key: 'Content-Security-Policy', value: cspDirectives },
          // Prevent clickjacking
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          // Stop MIME-type sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Control referer information sent to third parties
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Restrict browser feature access
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          // Force HTTPS for 2 years (production only — avoid breaking http in dev)
          ...(isDev ? [] : [
            { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          ]),
          // Legacy DNS prefetch opt-in for performance
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
        ],
      },
    ];
  },
};

export default withPWA({
  dest: "public",
  disable: process.env.NODE_ENV === 'development',
  register: true,
})(nextConfig);
