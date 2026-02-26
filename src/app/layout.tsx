import type { Metadata, Viewport } from "next";
import { Barlow, Rubik, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { verifyEnvironmentConfiguration } from "@/lib/firebase/config/environments";

// Barlow - For headings (bold, modern)
const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
  fallback: ["system-ui", "-apple-system", "sans-serif"],
});

// Rubik - For body text (readable, clean)
const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  fallback: ["system-ui", "-apple-system", "sans-serif"],
});

// Geist Mono - For code blocks
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  fallback: ["Courier New", "monospace"],
});

export const viewport: Viewport = {
  themeColor: '#0A66C2',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  manifest: "/manifest.json",
  title: {
    default: "LinkedIn AutoPoster",
    template: "%s | LinkedIn AutoPoster",
  },
  description: "AI-powered LinkedIn post automation — schedule, generate and publish content automatically",
  keywords: ["LinkedIn", "automation", "AI", "posts", "social media", "scheduling"],
  authors: [{ name: "LinkedIn AutoPoster" }],
  creator: "LinkedIn AutoPoster",
  applicationName: "LinkedIn AutoPoster",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "LI AutoPoster",
    startupImage: "/icons/linkedin-512x512.png",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: [
      { url: "/icons/linkedin-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/linkedin-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/icons/linkedin-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/icons/linkedin-192x192.png",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    title: "LinkedIn AutoPoster",
    description: "AI-powered LinkedIn post automation — schedule, generate and publish content automatically",
    siteName: "LinkedIn AutoPoster",
    images: [
      {
        url: "/icons/linkedin-512x512.png",
        width: 512,
        height: 512,
        alt: "LinkedIn AutoPoster",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Verify environment configuration on server-side only
  if (typeof window === 'undefined') {
    verifyEnvironmentConfiguration();
  }
  
  return (
    <html lang="en">
      <body
        className={`${barlow.variable} ${rubik.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
