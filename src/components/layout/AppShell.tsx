'use client';

/**
 * AppShell — Shared layout wrapper for the autoposter section.
 *
 * Desktop:  persistent sidebar (240px) + main content area
 * Mobile:   bottom tab bar (fixed) + full-width content
 *
 * Uses only shadcn tokens — no hardcoded colors.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Layers,
  Lightbulb,
  Settings,
  User,
  Menu,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useState } from 'react';

// ── Navigation Items ─────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/series', label: 'Series', icon: Layers },
  { href: '/ideas', label: 'Ideas', icon: Lightbulb },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const;

const SECONDARY_NAV = [
  { href: '/profile', label: 'Profile', icon: User },
] as const;

// ── Sidebar Link ─────────────────────────────────────────────────────────────

function NavLink({
  href,
  label,
  icon: Icon,
  isActive,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  isActive: boolean;
  onClick?: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={href}
          onClick={onClick}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            isActive
              ? 'bg-secondary text-foreground'
              : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground',
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span>{label}</span>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="right" className="md:hidden">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

// ── Desktop Sidebar ──────────────────────────────────────────────────────────

function DesktopSidebar({ pathname }: { pathname: string }) {
  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 md:z-30 border-r bg-card">
      {/* Logo / Brand */}
      <div className="flex h-14 items-center px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-sm font-bold text-primary-foreground">LP</span>
          </div>
          <span className="text-base font-semibold tracking-tight">AutoPoster</span>
        </Link>
      </div>

      <Separator />

      {/* Main Nav */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.href}
            {...item}
            isActive={pathname === item.href}
          />
        ))}
      </nav>

      {/* Secondary Nav */}
      <div className="px-3 pb-4 space-y-1">
        <Separator className="mb-3" />
        {SECONDARY_NAV.map((item) => (
          <NavLink
            key={item.href}
            {...item}
            isActive={pathname === item.href}
          />
        ))}
      </div>
    </aside>
  );
}

// ── Mobile Top Bar + Sheet ───────────────────────────────────────────────────

function MobileHeader({
  pathname,
  open,
  setOpen,
}: {
  pathname: string;
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const currentPage = NAV_ITEMS.find((i) => i.href === pathname)?.label ?? 'AutoPoster';

  return (
    <header className="md:hidden sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-card px-4">
      <div className="flex items-center gap-3">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Menu className="h-4 w-4" />
              <span className="sr-only">Menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <div className="flex h-14 items-center px-4">
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                  <span className="text-sm font-bold text-primary-foreground">LP</span>
                </div>
                <span className="text-base font-semibold tracking-tight">AutoPoster</span>
              </Link>
            </div>
            <Separator />
            <nav className="space-y-1 px-3 py-4">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.href}
                  {...item}
                  isActive={pathname === item.href}
                  onClick={() => setOpen(false)}
                />
              ))}
              <Separator className="my-3" />
              {SECONDARY_NAV.map((item) => (
                <NavLink
                  key={item.href}
                  {...item}
                  isActive={pathname === item.href}
                  onClick={() => setOpen(false)}
                />
              ))}
            </nav>
          </SheetContent>
        </Sheet>
        <span className="text-sm font-semibold">{currentPage}</span>
      </div>
    </header>
  );
}

// ── Mobile Bottom Tab Bar ────────────────────────────────────────────────────

function MobileTabBar({ pathname }: { pathname: string }) {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t bg-card">
      <div className="flex items-center justify-around py-1.5">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex flex-col items-center gap-0.5 px-2 py-1.5 text-[10px] font-medium transition-colors',
                isActive
                  ? 'text-foreground'
                  : 'text-muted-foreground',
              )}
            >
              <Icon className={cn('h-5 w-5', isActive && 'text-foreground')} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={300}>
      <div className="min-h-screen bg-background">
        <DesktopSidebar pathname={pathname} />
        <MobileHeader pathname={pathname} open={sheetOpen} setOpen={setSheetOpen} />

        {/* Main content — offset by sidebar width on desktop */}
        <main className="md:pl-60">
          <div className="mx-auto max-w-5xl px-4 py-6 pb-24 md:px-8 md:py-8 md:pb-8">
            {children}
          </div>
        </main>

        <MobileTabBar pathname={pathname} />
      </div>
    </TooltipProvider>
  );
}
