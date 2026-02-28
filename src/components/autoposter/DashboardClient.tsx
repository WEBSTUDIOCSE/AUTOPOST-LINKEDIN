'use client';

/**
 * Dashboard — Main hub for the LinkedIn Autoposter
 *
 * Shows:
 *   - Stats: total series, ideas, posts, published count
 *   - Active series overview
 *   - Recent ideas
 *   - Next post + upcoming posts
 *   - Recent published posts
 *
 * Fetches /api/posts, /api/series, /api/ideas in parallel.
 */

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  CheckCircle2,
  Clock,
  Layers,
  Lightbulb,
  Send,
  RotateCcw,
  PenLine,
  XCircle,
  Calendar,
  ArrowRight,
  Plus,
  FileText,
  Image as ImageIcon,
  Video,
  Code2,
  Sparkles,
  Eye,
} from 'lucide-react';
import Link from 'next/link';
import type { Post, PostStatus, Series, Idea } from '@/lib/linkedin/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

function formatTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
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
  scheduled: { label: 'Scheduled', variant: 'outline' },
  pending_review: { label: 'Pending', variant: 'outline' },
  approved: { label: 'Approved', variant: 'secondary' },
  published: { label: 'Published', variant: 'default' },
  skipped: { label: 'Skipped', variant: 'secondary' },
  rejected: { label: 'Rejected', variant: 'destructive' },
  failed: { label: 'Failed', variant: 'destructive' },
};

const MEDIA_ICONS = {
  text: FileText,
  image: ImageIcon,
  video: Video,
  html: Code2,
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
        <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
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
            Generate an AI post or schedule one from the Posts page.
          </p>
          <Link href="/posts" className="mt-4">
            <Button size="sm" variant="outline">
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Create a Post
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const displayContent = post.editedContent ?? post.content;
  const isPending = post.status === 'pending_review';
  const statusConfig = STATUS_CONFIG[post.status] ?? { label: post.status, variant: 'outline' as const };
  const mediaType = (post.mediaType ?? 'text') as keyof typeof MEDIA_ICONS;
  const MediaIcon = MEDIA_ICONS[mediaType] ?? MEDIA_ICONS.text;

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
              <MediaIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDate(post.scheduledFor)} at {formatTime(post.scheduledFor)}
              {isPending && <span className="ml-2">· Review by {formatTime(post.reviewDeadline)}</span>}
            </p>
          </div>
          <Link href="/posts" title="View in Posts">
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
              <Eye className="h-3.5 w-3.5" /><span className="sr-only">View post</span>
            </Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border bg-secondary/30 p-4 max-h-60 overflow-y-auto">
          <p className="text-sm leading-relaxed whitespace-pre-line">{displayContent}</p>
        </div>

        {isPending && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => onAction(post.id, 'approve')}>
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => onAction(post.id, 'publish')}>
              <Send className="mr-1.5 h-3.5 w-3.5" />Publish Now
            </Button>
            <Button size="sm" variant="outline" onClick={() => onAction(post.id, 'regenerate')}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />Regenerate
            </Button>
            <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => onAction(post.id, 'reject')}>
              <XCircle className="mr-1.5 h-3.5 w-3.5" />Reject
            </Button>
          </div>
        )}

        {post.status === 'approved' && (
          <Button size="sm" onClick={() => onAction(post.id, 'publish')}>
            <Send className="mr-1.5 h-3.5 w-3.5" />Publish Now
          </Button>
        )}

        {post.status === 'failed' && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => onAction(post.id, 'retry')}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />Retry
            </Button>
            <p className="text-xs text-destructive truncate">{post.failureReason}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Series Mini Card ─────────────────────────────────────────────────────────

function SeriesMiniCard({ series }: { series: Series }) {
  const queue = series.topicQueue ?? [];
  const progress = queue.length > 0
    ? Math.round((series.currentIndex / queue.length) * 100)
    : 0;

  return (
    <div className="flex items-center gap-3 py-3">
      <div className="shrink-0 rounded-lg bg-secondary p-2">
        <Layers className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{series.title}</p>
        <div className="flex items-center gap-2 mt-1">
          <Progress value={progress} className="h-1.5 flex-1" />
          <span className="text-[10px] text-muted-foreground shrink-0">
            {series.currentIndex}/{queue.length}
          </span>
        </div>
      </div>
      <Badge
        variant={series.status === 'active' ? 'default' : series.status === 'paused' ? 'secondary' : 'outline'}
        className="text-[10px] shrink-0"
      >
        {series.status}
      </Badge>
    </div>
  );
}

// ── Idea Mini Row ────────────────────────────────────────────────────────────

function IdeaMiniRow({ idea }: { idea: Idea }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <div className="shrink-0 mt-0.5 rounded-lg bg-secondary p-2">
        <Lightbulb className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-relaxed line-clamp-2">{idea.text}</p>
      </div>
      <Badge variant={idea.used ? 'secondary' : 'outline'} className="text-[10px] shrink-0 mt-0.5">
        {idea.used ? 'Used' : 'Unused'}
      </Badge>
    </div>
  );
}

// ── Post Row ─────────────────────────────────────────────────────────────────

function PostRow({ post }: { post: Post }) {
  const statusConfig = STATUS_CONFIG[post.status] ?? { label: post.status, variant: 'outline' as const };
  const isPublished = post.status === 'published';
  const mediaType = (post.mediaType ?? 'text') as keyof typeof MEDIA_ICONS;
  const MediaIcon = MEDIA_ICONS[mediaType] ?? MEDIA_ICONS.text;

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
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium truncate">{post.topic}</p>
          <MediaIcon className="h-3 w-3 text-muted-foreground shrink-0" />
        </div>
        <p className="text-xs text-muted-foreground">
          {isPublished && post.publishedAt ? timeAgo(post.publishedAt) : formatDate(post.scheduledFor)}
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
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!user) return;
    try {
      const [postsRes, seriesRes, ideasRes] = await Promise.all([
        fetch('/api/posts?limit=20'),
        fetch('/api/series'),
        fetch('/api/ideas'),
      ]);
      const [postsData, seriesData, ideasData] = await Promise.all([
        postsRes.json(), seriesRes.json(), ideasRes.json(),
      ]);
      if (postsData.success) setPosts(postsData.data ?? []);
      if (seriesData.success) setSeriesList(seriesData.data ?? []);
      if (ideasData.success) setIdeas(ideasData.data ?? []);
    } catch {
      // Silently fail — empty states shown
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Derive stats
  const published = posts.filter((p) => p.status === 'published');
  const upcoming = posts.filter((p) => p.status === 'pending_review' || p.status === 'approved');
  const activeSeries = seriesList.filter((s) => s.status === 'active');
  const unusedIdeas = ideas.filter((i) => !i.used);
  const nextPost = upcoming[0] ?? null;

  // Post action handler — includes HTML→PNG capture for approve/publish on HTML posts
  const handleAction = async (postId: string, action: string, content?: string) => {
    try {
      let imageBase64: string | undefined;
      let imageBase64Array: string[] | undefined;

      // For approve/publish on HTML posts, capture HTML→PNG client-side
      if (action === 'approve' || action === 'publish') {
        const post = posts.find(p => p.id === postId);
        if (post?.mediaType === 'html' && post.htmlContent) {
          try {
            const html2canvas = (await import('html2canvas')).default;
            const pc = post.pageCount ?? 1;

            // Resolve CSS custom properties BEFORE capture — html2canvas can't handle var()
            const resolveVars = (rawHtml: string): string => {
              const vars = new Map<string, string>();
              const rootRe = /(?::root|html|body)\s*\{([^}]+)\}/gi;
              let bm: RegExpExecArray | null;
              while ((bm = rootRe.exec(rawHtml)) !== null) {
                const propRe = /(--[\w-]+)\s*:\s*([^;]+)/g;
                let pm: RegExpExecArray | null;
                while ((pm = propRe.exec(bm[1])) !== null) {
                  vars.set(pm[1].trim(), pm[2].trim());
                }
              }
              if (vars.size === 0) return rawHtml;
              let out = rawHtml;
              for (let p = 0; p < 5; p++) {
                const prev = out;
                out = out.replace(
                  /var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/g,
                  (_m, name: string, fb?: string) => vars.get(name) ?? fb?.trim() ?? _m,
                );
                if (out === prev) break;
              }
              return out;
            };

            const resolved = resolveVars(post.htmlContent);

            // Parse dimensions from HTML CSS rules
            const wMatch = resolved.match(/(?:html|body)\s*[^}]*?width\s*:\s*(\d+)px/);
            const designW = wMatch ? parseInt(wMatch[1], 10) : 1080;

            // Extract background color from resolved HTML (no var() issues)
            const bgColor = (() => {
              const m1 = resolved.match(/(?:html|body)\s*\{[^}]*?background-color\s*:\s*([^;}]+)/i);
              if (m1 && !m1[1].includes('var(') && !m1[1].includes('gradient')) return m1[1].trim();
              const m2 = resolved.match(/(?:html|body)\s*\{[^}]*?background\s*:\s*(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\)|hsl[a]?\([^)]+\)|[a-zA-Z]+)/i);
              if (m2 && !m2[1].includes('var(') && !m2[1].includes('gradient')) return m2[1].trim();
              return '#0f172a';
            })();

            if (pc > 1) {
              const pageH = designW;
              const totalH = pageH * pc;
              const results: string[] = [];
              // Capture all pages from a single iframe load
              await new Promise<void>((resolve, reject) => {
                const iframe = document.createElement('iframe');
                iframe.style.cssText = `position:fixed;left:-9999px;top:0;width:${designW}px;height:${totalH}px;border:none;`;
                iframe.sandbox.add('allow-same-origin');
                iframe.srcdoc = resolved;
                iframe.onload = async () => {
                  try {
                    const doc = iframe.contentDocument;
                    if (!doc?.documentElement) throw new Error('Cannot access iframe content');
                    // Wait for fonts + paint
                    await Promise.race([doc.fonts?.ready ?? Promise.resolve(), new Promise(r => setTimeout(r, 3000))]);
                    await new Promise(r => setTimeout(r, 200));

                    // Try to capture individual slide elements instead of Y-offset slicing
                    const slides = doc.querySelectorAll('.slide, [class*="slide"], body > div, body > section');
                    const slideEls = slides.length >= pc ? Array.from(slides).slice(0, pc) : null;

                    if (slideEls) {
                      for (const el of slideEls) {
                        const canvas = await html2canvas(el as HTMLElement, {
                          width: designW, height: pageH, scale: 2, useCORS: true,
                          backgroundColor: bgColor, windowWidth: designW, windowHeight: pageH,
                        });
                        results.push(canvas.toDataURL('image/png').split(',')[1]);
                      }
                    } else {
                      // Fallback: Y-offset slicing
                      for (let i = 0; i < pc; i++) {
                        const canvas = await html2canvas(doc.documentElement, {
                          width: designW, height: pageH, y: i * pageH, scale: 2, useCORS: true,
                          backgroundColor: bgColor, windowWidth: designW, windowHeight: totalH,
                        });
                        results.push(canvas.toDataURL('image/png').split(',')[1]);
                      }
                    }
                    resolve();
                  } catch (err) { reject(err); }
                  finally { document.body.removeChild(iframe); }
                };
                iframe.onerror = () => { document.body.removeChild(iframe); reject(new Error('iframe failed')); };
                document.body.appendChild(iframe);
              });
              imageBase64Array = results;
            } else {
              // Single page capture
              const hMatch = resolved.match(/(?:html|body)\s*[^}]*?height\s*:\s*(\d+)px/);
              const designH = hMatch ? parseInt(hMatch[1], 10) : undefined;
              const capH = designH ?? 2000;
              imageBase64 = await new Promise<string>((resolve, reject) => {
                const iframe = document.createElement('iframe');
                iframe.style.cssText = `position:fixed;left:-9999px;top:0;width:${designW}px;height:${capH}px;border:none;`;
                iframe.sandbox.add('allow-same-origin');
                iframe.srcdoc = resolved;
                iframe.onload = async () => {
                  try {
                    const doc = iframe.contentDocument;
                    if (!doc?.documentElement) throw new Error('Cannot access iframe content');
                    await Promise.race([doc.fonts?.ready ?? Promise.resolve(), new Promise(r => setTimeout(r, 3000))]);
                    await new Promise(r => setTimeout(r, 200));
                    const finalH = designH ?? (doc.documentElement.scrollHeight || capH);
                    const canvas = await html2canvas(doc.documentElement, {
                      width: designW, height: finalH, scale: 2, useCORS: true,
                      backgroundColor: bgColor, windowWidth: designW, windowHeight: finalH,
                    });
                    resolve(canvas.toDataURL('image/png').split(',')[1]);
                  } catch (err) { reject(err); }
                  finally { document.body.removeChild(iframe); }
                };
                iframe.onerror = () => { document.body.removeChild(iframe); reject(new Error('iframe failed')); };
                document.body.appendChild(iframe);
              });
            }
          } catch (captureErr) {
            alert(`Failed to capture HTML card: ${captureErr instanceof Error ? captureErr.message : 'Unknown error'}`);
            return;
          }
        }
      }

      const res = await fetch('/api/posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, action, editedContent: content, imageBase64, imageBase64Array }),
      });
      const data = await res.json();
      if (!data.success && data.error) {
        alert(data.error);
      }
      fetchAll();
    } catch {
      // TODO: toast error
    }
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Your LinkedIn content engine at a glance.
          </p>
        </div>
        <Link href="/posts">
          <Button size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            Create Post
          </Button>
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Series" value={seriesList.length} icon={Layers} loading={loading} />
        <StatCard label="Ideas" value={unusedIdeas.length} icon={Lightbulb} loading={loading} />
        <StatCard label="Upcoming" value={upcoming.length} icon={Clock} loading={loading} />
        <StatCard label="Published" value={published.length} icon={Send} loading={loading} />
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
                <span className="text-xs text-muted-foreground">{formatDate(nextPost.scheduledFor)}</span>
              </TooltipTrigger>
              <TooltipContent>Scheduled publishing date</TooltipContent>
            </Tooltip>
          )}
        </div>
        <NextPostCard post={nextPost} loading={loading} onAction={handleAction} />
      </section>

      {/* Three-column (desktop) / single-column (mobile) grid */}
      <div className="grid gap-6 lg:grid-cols-3">

        {/* Active Series */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Series
              </CardTitle>
              <Link href="/series">
                <Button variant="ghost" size="sm" className="h-7 text-xs">
                  View All
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-lg" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-1.5 w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : seriesList.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">No series yet.</p>
                <Link href="/series" className="mt-2 inline-block">
                  <Button size="sm" variant="outline">
                    <Plus className="mr-1.5 h-3 w-3" />Create Series
                  </Button>
                </Link>
              </div>
            ) : (
              <ScrollArea className={seriesList.length > 4 ? 'h-56' : undefined}>
                <div className="divide-y">
                  {seriesList.slice(0, 8).map((s) => (
                    <SeriesMiniCard key={s.id} series={s} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Ideas */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Ideas
              </CardTitle>
              <Link href="/ideas">
                <Button variant="ghost" size="sm" className="h-7 text-xs">
                  View All
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-full" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : ideas.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">No ideas yet.</p>
                <Link href="/ideas" className="mt-2 inline-block">
                  <Button size="sm" variant="outline">
                    <Sparkles className="mr-1.5 h-3 w-3" />Add Ideas
                  </Button>
                </Link>
              </div>
            ) : (
              <ScrollArea className={ideas.length > 4 ? 'h-56' : undefined}>
                <div className="divide-y">
                  {ideas.slice(0, 8).map((idea) => (
                    <IdeaMiniRow key={idea.id} idea={idea} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>

        {/* Recent Posts */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Recent Posts
              </CardTitle>
              <Link href="/posts">
                <Button variant="ghost" size="sm" className="h-7 text-xs">
                  View All
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
            ) : posts.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-sm text-muted-foreground">No posts yet.</p>
                <Link href="/posts" className="mt-2 inline-block">
                  <Button size="sm" variant="outline">
                    <Plus className="mr-1.5 h-3 w-3" />Create Post
                  </Button>
                </Link>
              </div>
            ) : (
              <ScrollArea className={posts.length > 4 ? 'h-56' : undefined}>
                <div className="divide-y">
                  {posts.slice(0, 10).map((post) => (
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
