'use client';

/**
 * Series Management — Create, view, edit, reorder, and delete topic series.
 *
 * Each series has an ordered queue of topics the AI covers sequentially.
 * Cards show progress, status, and allow inline editing.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Upload,
} from 'lucide-react';
import type { Series, SeriesStatus, SeriesTopic, HtmlTemplate } from '@/lib/linkedin/types';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  /** Parse a CSV file and append topics. Supports:
   *  - One topic per line (plain text)
   *  - CSV with header row: title,notes  (first column = title, second = notes)
   */
  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length === 0) return;

      // Detect if first line is a header (contains "title" case-insensitive)
      let startIdx = 0;
      const firstLine = lines[0].toLowerCase();
      if (firstLine.includes('title')) startIdx = 1;

      const parsed: SeriesTopic[] = [];
      for (let i = startIdx; i < lines.length; i++) {
        // Simple CSV split: handle quoted fields
        const cols = lines[i].match(/("[^"]*"|[^,]+)/g)?.map(c => c.replace(/^"|"$/g, '').trim()) ?? [];
        const title = cols[0];
        if (!title) continue;
        parsed.push({ title, notes: cols[1] || undefined });
      }

      if (parsed.length > 0) onChange([...topics, ...parsed]);
    };
    reader.readAsText(file);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="Add a topic..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTopic())}
          className="flex-1 h-10"
        />
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={addTopic}
            disabled={!newTitle.trim()}
            className="flex-1 sm:flex-none h-10 touch-manipulation"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add
          </Button>
          {/* CSV upload */}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            title="Upload topics from CSV"
            className="flex-1 sm:flex-none h-10 touch-manipulation"
          >
            <Upload className="h-4 w-4 mr-1.5" />
            CSV
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={handleCsvUpload}
          />
        </div>
      </div>

      {topics.length > 0 && (
        <ScrollArea className={topics.length > 6 ? 'h-52' : undefined}>
          <div className="space-y-1.5 pr-1">
            {topics.map((topic, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-md border bg-secondary/30 px-2.5 py-2 text-sm min-w-0"
              >
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground w-5 shrink-0 tabular-nums">{i + 1}.</span>
                <span className="flex-1 min-w-0 break-words text-sm leading-snug">{topic.title}</span>
                <div className="flex items-center gap-0.5 shrink-0 ml-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 touch-manipulation"
                    onClick={() => moveTopic(i, 'up')}
                    disabled={i === 0}
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 touch-manipulation"
                    onClick={() => moveTopic(i, 'down')}
                    disabled={i === topics.length - 1}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 touch-manipulation text-muted-foreground hover:text-destructive"
                    onClick={() => removeTopic(i)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {topics.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Add topics manually or{' '}
          <button type="button" className="underline hover:text-foreground" onClick={() => fileInputRef.current?.click()}>upload a CSV</button>.
        </p>
      )}
    </div>
  );
}

// ── Create / Edit Dialog ─────────────────────────────────────────────────────

function SeriesDialog({
  series,
  templates,
  open,
  onOpenChange,
  onSave,
  saving,
}: {
  series?: Series;
  templates: HtmlTemplate[];
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (data: { title: string; category: string; topicQueue: SeriesTopic[]; templateId?: string }) => Promise<void>;
  saving: boolean;
}) {
  const isEdit = !!series;
  const [title, setTitle] = useState(series?.title ?? '');
  const [category, setCategory] = useState(series?.category ?? '');
  const [topics, setTopics] = useState<SeriesTopic[]>(series?.topicQueue ?? []);
  const [templateId, setTemplateId] = useState(series?.templateId ?? '');

  // Reset form when dialog opens with different series
  useEffect(() => {
    setTitle(series?.title ?? '');
    setCategory(series?.category ?? '');
    setTopics(series?.topicQueue ?? []);
    setTemplateId(series?.templateId ?? '');
  }, [series, open]);

  const canSubmit = title.trim() && category.trim() && topics.length > 0 && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onSave({
      title: title.trim(),
      category: category.trim(),
      topicQueue: topics,
      templateId: templateId || undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-2xl flex flex-col max-h-[95dvh] sm:max-h-[85dvh] rounded-xl overflow-hidden p-0">
        <DialogHeader className="flex-shrink-0 px-5 pt-5 pb-3 border-b">
          <DialogTitle className="text-lg">{isEdit ? 'Edit Series' : 'New Series'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 px-5 py-4 overflow-y-auto overflow-x-hidden flex-1 min-h-0">
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

          {/* Default Template for this series */}
          {templates.length > 0 && (
            <div className="space-y-2">
              <Label>Default Template <span className="text-xs text-muted-foreground">(optional — for HTML posts)</span></Label>
              <Select
                value={templateId || '_none'}
                onValueChange={(v) => setTemplateId(v === '_none' ? '' : v)}
              >
                <SelectTrigger><SelectValue placeholder="No template" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No template</SelectItem>
                  {templates.map(t => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>Topics ({topics.length})</Label>
            <TopicInput topics={topics} onChange={setTopics} />
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 px-5 py-4 border-t gap-2">
          <DialogClose asChild>
            <Button variant="outline" className="flex-1 sm:flex-none touch-manipulation">
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleSubmit} disabled={!canSubmit} className="flex-1 sm:flex-none touch-manipulation">
            {saving ? 'Saving...' : isEdit ? 'Update Series' : 'Create Series'}
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
    <Card className="transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base leading-snug">{series.title}</CardTitle>
              <Badge variant={statusConfig.variant} className="text-[10px] shrink-0">
                {statusConfig.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{series.category}</p>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 touch-manipulation"
                  onClick={() => onToggleStatus(series)}
                  disabled={series.status === 'completed'}
                >
                  {series.status === 'active' ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Play className="h-4 w-4" />
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
                  className="h-8 w-8 touch-manipulation"
                  onClick={() => onEdit(series)}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 touch-manipulation text-muted-foreground hover:text-destructive"
                  onClick={() => onDelete(series)}
                >
                  <Trash2 className="h-4 w-4" />
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
              className="h-8 w-full text-xs text-muted-foreground touch-manipulation"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? 'Hide topics' : `Show all ${series.topicQueue.length} topics`}
              {expanded ? (
                <ChevronUp className="ml-1 h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="ml-1 h-3.5 w-3.5" />
              )}
            </Button>

            {expanded && (
              <ScrollArea className={series.topicQueue.length > 6 ? 'h-44' : undefined}>
                <div className="space-y-1 pr-2">
                  {series.topicQueue.map((topic, i) => (
                    <div
                      key={i}
                      className={`flex items-start gap-2 rounded-md px-3 py-2 text-sm ${
                        i < series.currentIndex
                          ? 'text-muted-foreground line-through'
                          : i === series.currentIndex
                            ? 'bg-secondary font-medium'
                            : ''
                      }`}
                    >
                      <span className="text-xs text-muted-foreground w-5 shrink-0 tabular-nums pt-0.5">{i + 1}.</span>
                      <span className="break-words min-w-0 leading-snug">{topic.title}</span>
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
  const [templates, setTemplates] = useState<HtmlTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSeries, setEditingSeries] = useState<Series | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<Series | null>(null);

  const fetchSeries = useCallback(async () => {
    if (!user) return;
    try {
      const [seriesRes, templatesRes] = await Promise.all([
        fetch('/api/series'),
        fetch('/api/templates'),
      ]);
      const [seriesData, templatesData] = await Promise.all([
        seriesRes.json(), templatesRes.json(),
      ]);
      if (seriesData.success) setSeriesList(seriesData.data ?? []);
      if (templatesData.success) setTemplates(templatesData.data ?? []);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  useEffect(() => {
    fetchSeries();
  }, [fetchSeries]);

  // Create or Update
  const handleSave = async (formData: { title: string; category: string; topicQueue: SeriesTopic[]; templateId?: string }) => {
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Series</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Organize your posts into themed topic sequences.
          </p>
        </div>
        <Button onClick={openCreate} className="w-full sm:w-auto touch-manipulation">
          <Plus className="mr-1.5 h-4 w-4" />
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
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
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
        templates={templates}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-sm rounded-xl overflow-hidden p-0">
          <DialogHeader className="px-5 pt-5 pb-3 border-b">
            <DialogTitle>Delete series?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground px-5 py-4">
            &ldquo;{deleteTarget?.title}&rdquo; and all its topics will be permanently deleted.
            Existing posts from this series won&apos;t be affected.
          </p>
          <DialogFooter className="px-5 pb-5 gap-2">
            <DialogClose asChild>
              <Button variant="outline" className="flex-1 sm:flex-none touch-manipulation">
                Cancel
              </Button>
            </DialogClose>
            <Button variant="destructive" className="flex-1 sm:flex-none touch-manipulation" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
