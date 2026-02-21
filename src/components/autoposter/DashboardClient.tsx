'use client';

/**
 * Dashboard — Main hub for the LinkedIn Autoposter
 *
 * Layout (desktop):
 *   ┌────────────┬────────────────────┐
 *   │ Stats Row  │ (4 compact cards)  │
 *   ├────────────┴────────────────────┤
 *   │ Next Post Preview (hero card)   │
 *   ├─────────────┬──────────────────-┤
 *   │ Upcoming    │ Recent Posts      │
 *   └─────────────┴──────────────────-┘
 *
 * Mobile: single column, same order
 */

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  CheckCircle2,
  Clock,
  SkipForward,
  Flame,
  Layers,
  Lightbulb,
  Send,
  RotateCcw,
  PenLine,
  XCircle,
  Calendar,
  ArrowRight,
  Plus,
} from 'lucide-react';
import Link from 'next/link';
import type { Post, PostStatus } from '@/lib/linkedin/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function formatTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function timeAgo(date: Date | string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const STATUS_CONFIG: Record<PostStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending_review: { label: 'Pending', variant: 'outline' },
  approved: { label: 'Approved', variant: 'secondary' },
  published: { label: 'Published', variant: 'default' },
  skipped: { label: 'Skipped', variant: 'secondary' },
  rejected: { label: 'Rejected', variant: 'destructive' },
  failed: { label: 'Failed', variant: 'destructive' },
};

// ── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon: Icon,
  loading,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  loading?: boolean;
}) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            {loading ? (
              <Skeleton className="h-7 w-12" />
            ) : (
              <p className="text-2xl font-bold tracking-tight">{value}</p>
            )}
          </div>
          <div className="rounded-lg bg-secondary p-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Next Post Hero ───────────────────────────────────────────────────────────

function NextPostCard({
  post,
  loading,
  onAction,
}: {
  post: Post | null;
  loading?: boolean;
  onAction: (postId: string, action: string, content?: string) => Promise<void>;
}) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  if (!post) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <div className="rounded-full bg-secondary p-3 mb-4">
            <Calendar className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium">No upcoming posts</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            Posts are auto-generated at 9 PM the night before posting day,
            or you can create one manually.
          </p>
          <Link href="/series" className="mt-4">
            <Button size="sm" variant="outline">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Create a Series
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const displayContent = post.editedContent ?? post.content;
  const isPending = post.status === 'pending_review';
  const statusConfig = STATUS_CONFIG[post.status];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base truncate">{post.topic}</CardTitle>
              <Badge variant={statusConfig.variant} className="shrink-0 text-[10px]">
                {statusConfig.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDate(post.scheduledFor)} at {formatTime(post.scheduledFor)}
              {isPending && (
                <span className="ml-2">
                  · Review by {formatTime(post.reviewDeadline)}
                </span>
              )}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Post preview */}
        <div className="rounded-lg border bg-secondary/30 p-4">
          <p className="text-sm leading-relaxed whitespace-pre-line line-clamp-8">
            {displayContent}
          </p>
        </div>

        {/* Actions */}
        {isPending && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => onAction(post.id, 'approve')}
            >
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAction(post.id, 'regenerate')}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Regenerate
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => onAction(post.id, 'reject')}
            >
              <XCircle className="mr-1.5 h-3.5 w-3.5" />
              Reject
            </Button>
          </div>
        )}

        {post.status === 'failed' && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => onAction(post.id, 'retry')}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
              Retry
            </Button>
            <p className="text-xs text-destructive truncate">{post.failureReason}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Post Row (for lists) ─────────────────────────────────────────────────────

function PostRow({ post }: { post: Post }) {
  const statusConfig = STATUS_CONFIG[post.status];
  const isPublished = post.status === 'published';

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="shrink-0 rounded-lg bg-secondary p-2">
        {isPublished ? (
          <Send className="h-3.5 w-3.5 text-muted-foreground" />
        ) : post.status === 'pending_review' ? (
          <PenLine className="h-3.5 w-3.5 text-muted-foreground" />
        ) : (
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{post.topic}</p>
        <p className="text-xs text-muted-foreground">
          {isPublished && post.publishedAt
            ? timeAgo(post.publishedAt)
            : formatDate(post.scheduledFor)}
        </p>
      </div>

      <Badge variant={statusConfig.variant} className="shrink-0 text-[10px]">
        {statusConfig.label}
      </Badge>
    </div>
  );
}

// ── Main Dashboard ───────────────────────────────────────────────────────────

export default function DashboardClient() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPosts = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/posts?limit=20');
      const data = await res.json();
      if (data.success) setPosts(data.data ?? []);
    } catch {
      // Silently fail — UI shows empty states
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Derive stats
  const published = posts.filter((p) => p.status === 'published');
  const upcoming = posts.filter((p) => p.status === 'pending_review' || p.status === 'approved');
  const skipped = posts.filter((p) => p.status === 'skipped');
  const nextPost = upcoming[0] ?? null;

  // Post action handler
  const handleAction = async (postId: string, action: string, content?: string) => {
    try {
      await fetch('/api/posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, action, editedContent: content }),
      });
      fetchPosts(); // Refresh
    } catch {
      // TODO: toast error
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your LinkedIn content engine at a glance.
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Published" value={published.length} icon={Send} loading={loading} />
        <StatCard label="Upcoming" value={upcoming.length} icon={Clock} loading={loading} />
        <StatCard label="Skipped" value={skipped.length} icon={SkipForward} loading={loading} />
        <StatCard label="Streak" value={0} icon={Flame} loading={loading} />
      </div>

      {/* Next Scheduled Post — hero card */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Next Post
          </h2>
          {nextPost && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="text-xs text-muted-foreground">
                  {formatDate(nextPost.scheduledFor)}
                </span>
              </TooltipTrigger>
              <TooltipContent>Scheduled publishing date</TooltipContent>
            </Tooltip>
          )}
        </div>
        <NextPostCard post={nextPost} loading={loading} onAction={handleAction} />
      </section>

      {/* Two-column: Upcoming + History */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Upcoming
              </CardTitle>
              <Link href="/series">
                <Button variant="ghost" size="sm" className="h-7 text-xs">
                  <Layers className="mr-1 h-3 w-3" />
                  Series
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-lg" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No upcoming posts. Set up a series to get started.
              </p>
            ) : (
              <ScrollArea className={upcoming.length > 4 ? 'h-64' : undefined}>
                <div className="divide-y">
                  {upcoming.map((post) => (
                    <PostRow key={post.id} post={post} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Recent History */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Recent
              </CardTitle>
              <Link href="/ideas">
                <Button variant="ghost" size="sm" className="h-7 text-xs">
                  <Lightbulb className="mr-1 h-3 w-3" />
                  Ideas
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-lg" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : published.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">
                No posts published yet.
              </p>
            ) : (
              <ScrollArea className={published.length > 4 ? 'h-64' : undefined}>
                <div className="divide-y">
                  {published.slice(0, 10).map((post) => (
                    <PostRow key={post.id} post={post} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
