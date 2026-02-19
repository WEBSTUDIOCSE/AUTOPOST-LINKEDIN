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
  
  // Enable experimental features for better performance
  experimental: {
    // Enable optimized CSS loading
    optimizeCss: true,
  },
  
  // Optimize production builds
  poweredByHeader: false,
  
  // Configure headers for better security
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
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
