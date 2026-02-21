'use client';

/**
 * Series Management — Create, view, edit, reorder, and delete topic series.
 *
 * Each series has an ordered queue of topics the AI covers sequentially.
 * Cards show progress, status, and allow inline editing.
 */

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Plus,
  Layers,
  Trash2,
  Pencil,
  Pause,
  Play,
  GripVertical,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import type { Series, SeriesStatus, SeriesTopic } from '@/lib/linkedin/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<SeriesStatus, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  active: { label: 'Active', variant: 'default' },
  paused: { label: 'Paused', variant: 'secondary' },
  completed: { label: 'Completed', variant: 'outline' },
};

// ── Topic Input ──────────────────────────────────────────────────────────────

function TopicInput({
  topics,
  onChange,
}: {
  topics: SeriesTopic[];
  onChange: (topics: SeriesTopic[]) => void;
}) {
  const [newTitle, setNewTitle] = useState('');

  const addTopic = () => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    onChange([...topics, { title: trimmed }]);
    setNewTitle('');
  };

  const removeTopic = (index: number) => {
    onChange(topics.filter((_, i) => i !== index));
  };

  const moveTopic = (index: number, direction: 'up' | 'down') => {
    const arr = [...topics];
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= arr.length) return;
    [arr[index], arr[target]] = [arr[target], arr[index]];
    onChange(arr);
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder="Add a topic..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTopic())}
          className="flex-1"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addTopic}
          disabled={!newTitle.trim()}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {topics.length > 0 && (
        <ScrollArea className={topics.length > 6 ? 'h-48' : undefined}>
          <div className="space-y-1.5">
            {topics.map((topic, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-md border bg-secondary/30 px-3 py-2 text-sm"
              >
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground w-5 shrink-0">{i + 1}.</span>
                <span className="flex-1 truncate">{topic.title}</span>
                <div className="flex items-center gap-0.5 shrink-0">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => moveTopic(i, 'up')}
                    disabled={i === 0}
                  >
                    <ChevronUp className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => moveTopic(i, 'down')}
                    disabled={i === topics.length - 1}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => removeTopic(i)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {topics.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Add topics the AI will cover in order.
        </p>
      )}
    </div>
  );
}

// ── Create / Edit Dialog ─────────────────────────────────────────────────────

function SeriesDialog({
  series,
  open,
  onOpenChange,
  onSave,
  saving,
}: {
  series?: Series;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (data: { title: string; category: string; topicQueue: SeriesTopic[] }) => Promise<void>;
  saving: boolean;
}) {
  const isEdit = !!series;
  const [title, setTitle] = useState(series?.title ?? '');
  const [category, setCategory] = useState(series?.category ?? '');
  const [topics, setTopics] = useState<SeriesTopic[]>(series?.topicQueue ?? []);

  // Reset form when dialog opens with different series
  useEffect(() => {
    setTitle(series?.title ?? '');
    setCategory(series?.category ?? '');
    setTopics(series?.topicQueue ?? []);
  }, [series, open]);

  const canSubmit = title.trim() && category.trim() && topics.length > 0 && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onSave({ title: title.trim(), category: category.trim(), topicQueue: topics });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Series' : 'New Series'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="series-title">Title</Label>
            <Input
              id="series-title"
              placeholder="e.g. Next.js Mastery"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="series-category">Category</Label>
            <Input
              id="series-category"
              placeholder="e.g. Web Development"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Topics ({topics.length})</Label>
            <TopicInput topics={topics} onChange={setTopics} />
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" size="sm">
              Cancel
            </Button>
          </DialogClose>
          <Button size="sm" onClick={handleSubmit} disabled={!canSubmit}>
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Series Card ──────────────────────────────────────────────────────────────

function SeriesCard({
  series,
  onEdit,
  onToggleStatus,
  onDelete,
}: {
  series: Series;
  onEdit: (s: Series) => void;
  onToggleStatus: (s: Series) => void;
  onDelete: (s: Series) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const statusConfig = STATUS_CONFIG[series.status];
  const progress = series.topicQueue.length > 0
    ? Math.round((series.currentIndex / series.topicQueue.length) * 100)
    : 0;
  const currentTopic = series.topicQueue[series.currentIndex];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base">{series.title}</CardTitle>
              <Badge variant={statusConfig.variant} className="text-[10px]">
                {statusConfig.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{series.category}</p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onToggleStatus(series)}
                  disabled={series.status === 'completed'}
                >
                  {series.status === 'active' ? (
                    <Pause className="h-3.5 w-3.5" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {series.status === 'active' ? 'Pause' : 'Resume'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onEdit(series)}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(series)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Progress</span>
            <span>{series.currentIndex} / {series.topicQueue.length}</span>
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {/* Current Topic */}
        {currentTopic && series.status !== 'completed' && (
          <div className="rounded-md bg-secondary/50 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Next topic</p>
            <p className="text-sm font-medium mt-0.5">{currentTopic.title}</p>
          </div>
        )}

        {/* Expand/collapse topic list */}
        {series.topicQueue.length > 0 && (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-full text-xs text-muted-foreground"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? 'Hide topics' : `Show all ${series.topicQueue.length} topics`}
              {expanded ? (
                <ChevronUp className="ml-1 h-3 w-3" />
              ) : (
                <ChevronDown className="ml-1 h-3 w-3" />
              )}
            </Button>

            {expanded && (
              <ScrollArea className={series.topicQueue.length > 6 ? 'h-40' : undefined}>
                <div className="space-y-1">
                  {series.topicQueue.map((topic, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm ${
                        i < series.currentIndex
                          ? 'text-muted-foreground line-through'
                          : i === series.currentIndex
                            ? 'bg-secondary font-medium'
                            : ''
                      }`}
                    >
                      <span className="text-xs text-muted-foreground w-5 shrink-0">{i + 1}.</span>
                      <span className="truncate">{topic.title}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function SeriesClient() {
  const { user } = useAuth();
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSeries, setEditingSeries] = useState<Series | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Series | null>(null);

  const fetchSeries = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/series');
      const data = await res.json();
      if (data.success) setSeriesList(data.data ?? []);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSeries();
  }, [fetchSeries]);

  // Create or Update
  const handleSave = async (formData: { title: string; category: string; topicQueue: SeriesTopic[] }) => {
    setSaving(true);
    try {
      if (editingSeries) {
        await fetch('/api/series', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seriesId: editingSeries.id, ...formData }),
        });
      } else {
        await fetch('/api/series', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, order: seriesList.length }),
        });
      }
      setDialogOpen(false);
      setEditingSeries(undefined);
      fetchSeries();
    } catch {
      // TODO: toast
    } finally {
      setSaving(false);
    }
  };

  // Toggle pause/resume
  const handleToggleStatus = async (s: Series) => {
    const newStatus = s.status === 'active' ? 'paused' : 'active';
    try {
      await fetch('/api/series', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seriesId: s.id, status: newStatus }),
      });
      fetchSeries();
    } catch {
      // TODO: toast
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/series?id=${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      fetchSeries();
    } catch {
      // TODO: toast
    }
  };

  const openCreate = () => {
    setEditingSeries(undefined);
    setDialogOpen(true);
  };

  const openEdit = (s: Series) => {
    setEditingSeries(s);
    setDialogOpen(true);
  };

  // Split by status for ordering
  const activeSeries = seriesList.filter((s) => s.status === 'active');
  const pausedSeries = seriesList.filter((s) => s.status === 'paused');
  const completedSeries = seriesList.filter((s) => s.status === 'completed');
  const grouped = [...activeSeries, ...pausedSeries, ...completedSeries];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Series</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Organize your posts into themed topic sequences.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          New Series
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-5 w-48" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-1.5 w-full rounded-full" />
                <Skeleton className="h-10 w-full rounded-md" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-secondary p-3 mb-4">
              <Layers className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No series yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              Create a series of topics and the AI will draft posts for each one in order.
            </p>
            <Button size="sm" className="mt-4" onClick={openCreate}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Create your first series
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {grouped.map((s) => (
            <SeriesCard
              key={s.id}
              series={s}
              onEdit={openEdit}
              onToggleStatus={handleToggleStatus}
              onDelete={setDeleteTarget}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <SeriesDialog
        series={editingSeries}
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setEditingSeries(undefined);
        }}
        onSave={handleSave}
        saving={saving}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete series?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            &ldquo;{deleteTarget?.title}&rdquo; and all its topics will be permanently deleted.
            Existing posts from this series won&apos;t be affected.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm">
                Cancel
              </Button>
            </DialogClose>
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
