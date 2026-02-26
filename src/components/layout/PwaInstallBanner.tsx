'use client';

/**
 * PwaInstallBanner
 *
 * Shows a native-feeling install prompt when the browser fires
 * the `beforeinstallprompt` event (Chrome / Edge / Android).
 * On iOS Safari (no beforeinstallprompt) shows a manual guide instead.
 *
 * - Appears as a bottom sheet on mobile, a floating card on desktop
 * - Persists dismissal in localStorage for 7 days
 * - Disappears automatically once the app is already installed
 */

import { useEffect, useState, useCallback } from 'react';
import Image from 'next/image';
import { Download, X, Share, MoreVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const DISMISSED_KEY = 'pwa-install-dismissed-at';
const DISMISS_DAYS = 7;

type Platform = 'chromium' | 'ios' | null;

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua);
  const isSafari = /safari/i.test(ua) && !/chrome/i.test(ua);
  return isIos && isSafari;
}

function isInStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window.navigator as any).standalone === true
  );
}

function wasDismissedRecently(): boolean {
  try {
    const ts = localStorage.getItem(DISMISSED_KEY);
    if (!ts) return false;
    const diff = Date.now() - parseInt(ts, 10);
    return diff < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function saveDismissed() {
  try {
    localStorage.setItem(DISMISSED_KEY, Date.now().toString());
  } catch {
    // ignore
  }
}

// ── iOS manual guide ─────────────────────────────────────────────────────────

function IosInstallGuide({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground leading-relaxed">
        To install the app on your iPhone / iPad:
      </p>
      <ol className="text-sm text-foreground space-y-2">
        <li className="flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0A66C2] text-white text-[11px] font-bold">1</span>
          Tap the <Share className="inline h-4 w-4 mx-0.5 text-blue-500" /> <strong>Share</strong> button in Safari&apos;s toolbar
        </li>
        <li className="flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0A66C2] text-white text-[11px] font-bold">2</span>
          Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong>
        </li>
        <li className="flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0A66C2] text-white text-[11px] font-bold">3</span>
          Tap <strong>Add</strong> in the top-right corner
        </li>
      </ol>
      <Button variant="outline" size="sm" className="w-full mt-1" onClick={onDismiss}>
        Got it
      </Button>
    </div>
  );
}

// ── Main banner ──────────────────────────────────────────────────────────────

export default function PwaInstallBanner() {
  const [platform, setPlatform] = useState<Platform>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Already running as installed PWA — hide
    if (isInStandaloneMode()) return;
    // Was dismissed recently — hide
    if (wasDismissedRecently()) return;

    if (isIosSafari()) {
      setPlatform('ios');
      setVisible(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setPlatform('chromium');
      setVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const result = await deferredPrompt.userChoice;
      if (result.outcome === 'accepted') {
        setVisible(false);
      }
    } finally {
      setInstalling(false);
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    saveDismissed();
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <>
      {/* Backdrop on mobile */}
      <div
        className="fixed inset-0 z-50 bg-black/30 md:hidden"
        onClick={handleDismiss}
        aria-hidden
      />

      {/* Banner */}
      <div
        role="dialog"
        aria-label="Install LinkedIn AutoPoster"
        className={cn(
          // Positioning: bottom sheet mobile, floating card desktop
          'fixed z-50 shadow-2xl',
          'bottom-0 left-0 right-0 rounded-t-2xl md:bottom-5 md:right-5 md:left-auto md:rounded-2xl md:w-80',
          // Visual
          'bg-card border border-border',
          // Animation
          'animate-in slide-in-from-bottom-4 duration-300',
        )}
      >
        {/* Drag handle (mobile only) */}
        <div className="flex justify-center pt-3 md:hidden">
          <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
        </div>

        <div className="p-5">
          {/* Header */}
          <div className="flex items-start gap-3 mb-4">
            <div className="relative h-12 w-12 shrink-0 rounded-xl overflow-hidden border border-border bg-[#0A66C2]">
              <Image
                src="/icons/linkedin-512x512.png"
                alt="LinkedIn AutoPoster"
                fill
                className="object-cover"
                unoptimized
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-foreground text-sm leading-tight">LinkedIn AutoPoster</p>
              <p className="text-xs text-muted-foreground mt-0.5">Install for quick access</p>
              {/* Mini features */}
              <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] bg-[#0A66C2]/10 text-[#0A66C2] rounded-full px-2 py-0.5 font-medium">Offline ready</span>
                <span className="text-[10px] bg-[#0A66C2]/10 text-[#0A66C2] rounded-full px-2 py-0.5 font-medium">No app store</span>
              </div>
            </div>
            <button
              onClick={handleDismiss}
              className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              aria-label="Dismiss install prompt"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          {platform === 'ios' ? (
            <IosInstallGuide onDismiss={handleDismiss} />
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                Install LinkedIn AutoPoster on your device for faster access and native app experience — no browser needed.
              </p>
              <div className="flex gap-2">
                <Button
                  className="flex-1 bg-[#0A66C2] hover:bg-[#004B87] text-white"
                  size="sm"
                  onClick={handleInstall}
                  disabled={installing}
                >
                  <Download className="h-4 w-4 mr-2" />
                  {installing ? 'Installing…' : 'Install App'}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDismiss}
                >
                  Not now
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Desktop: "3-dot menu" hint for Chromium browsers */}
        {platform === 'chromium' && (
          <div className="hidden md:flex items-center gap-1.5 px-5 pb-4 text-[11px] text-muted-foreground">
            <MoreVertical className="h-3 w-3" />
            Also available via browser menu → Install LinkedIn AutoPoster
          </div>
        )}
      </div>
    </>
  );
}
