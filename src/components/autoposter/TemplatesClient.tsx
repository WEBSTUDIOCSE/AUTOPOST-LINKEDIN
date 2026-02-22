'use client';

/**
 * Templates Management — Create, preview, edit, and delete HTML design templates.
 *
 * Templates define the visual style (colors, fonts, layout patterns) the AI
 * references when generating HTML infographic cards. Users paste sample HTML
 * and the system extracts the design language for reuse.
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Code2,
  Trash2,
  Pencil,
  Eye,
  Copy,
  X,
} from 'lucide-react';
import type { HtmlTemplate } from '@/lib/linkedin/types';

// ── Dimension Presets ────────────────────────────────────────────────────────

const DIMENSION_PRESETS = [
  { label: '1080×1080 (Square)', width: 1080, height: 1080 },
  { label: '1200×627 (LinkedIn Landscape)', width: 1200, height: 627 },
  { label: '1080×1350 (Portrait)', width: 1080, height: 1350 },
  { label: '1200×675 (16:9)', width: 1200, height: 675 },
  { label: 'Auto Height (1080w)', width: 1080, height: 0 },
] as const;

// ── HTML Preview (scaled iframe) ─────────────────────────────────────────────

function TemplatePreview({
  html,
  dimensions,
  className,
}: {
  html: string;
  dimensions: { width: number; height: number };
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver(([entry]) => {
      const containerWidth = entry.contentRect.width;
      if (containerWidth > 0 && dimensions.width > 0) {
        setScale(containerWidth / dimensions.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [dimensions.width]);

  const scaledHeight = dimensions.height * scale;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ height: scale > 0 ? `${scaledHeight}px` : '200px', position: 'relative', overflow: 'hidden' }}
    >
      {scale > 0 && (
        <iframe
          srcDoc={html}
          sandbox="allow-same-origin"
          title="Template preview"
          style={{
            width: `${dimensions.width}px`,
            height: `${dimensions.height}px`,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            border: 'none',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        />
      )}
    </div>
  );
}

// ── Create / Edit Dialog ─────────────────────────────────────────────────────

function TemplateDialog({
  template,
  open,
  onOpenChange,
  onSave,
  saving,
}: {
  template?: HtmlTemplate;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (data: {
    name: string;
    description?: string;
    htmlContent: string;
    dimensions: { width: number; height: number };
  }) => Promise<void>;
  saving: boolean;
}) {
  const isEdit = !!template;
  const [name, setName] = useState(template?.name ?? '');
  const [description, setDescription] = useState(template?.description ?? '');
  const [htmlContent, setHtmlContent] = useState(template?.htmlContent ?? '');
  const [dimensions, setDimensions] = useState(
    template?.dimensions ?? { width: 1080, height: 1080 }
  );
  const [showPreview, setShowPreview] = useState(false);

  // Reset form when dialog opens with different template
  useEffect(() => {
    setName(template?.name ?? '');
    setDescription(template?.description ?? '');
    setHtmlContent(template?.htmlContent ?? '');
    setDimensions(template?.dimensions ?? { width: 1080, height: 1080 });
    setShowPreview(false);
  }, [template, open]);

  const currentPreset = DIMENSION_PRESETS.find(
    p => p.width === dimensions.width && p.height === dimensions.height
  );

  const canSubmit = name.trim() && htmlContent.trim() && !saving;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      htmlContent: htmlContent.trim(),
      dimensions,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl flex flex-col max-h-[90dvh]">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>{isEdit ? 'Edit Template' : 'New Template'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2 overflow-y-auto flex-1 min-h-0 pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tpl-name">Template Name <span className="text-destructive">*</span></Label>
              <Input
                id="tpl-name"
                placeholder="e.g. Dark IDE Theme"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Dimensions</Label>
              <Select
                value={currentPreset ? `${dimensions.width}x${dimensions.height}` : 'custom'}
                onValueChange={(v) => {
                  const preset = DIMENSION_PRESETS.find(p => `${p.width}x${p.height}` === v);
                  if (preset) setDimensions({ width: preset.width, height: preset.height });
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DIMENSION_PRESETS.map(p => (
                    <SelectItem key={`${p.width}x${p.height}`} value={`${p.width}x${p.height}`}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tpl-desc">Description <span className="text-xs text-muted-foreground">(optional)</span></Label>
            <Input
              id="tpl-desc"
              placeholder="e.g. VS Code inspired dark theme with syntax highlighting colors"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="tpl-html">HTML Content <span className="text-destructive">*</span></Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setShowPreview(v => !v)}
                disabled={!htmlContent.trim()}
              >
                <Eye className="mr-1 h-3 w-3" />
                {showPreview ? 'Hide Preview' : 'Preview'}
              </Button>
            </div>
            <Textarea
              id="tpl-html"
              placeholder="Paste your complete HTML template here…"
              rows={showPreview ? 8 : 14}
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              className="font-mono text-xs"
            />
          </div>

          {showPreview && htmlContent.trim() && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Preview</Label>
              <div className="rounded-lg border overflow-hidden bg-black">
                <TemplatePreview html={htmlContent} dimensions={dimensions} />
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-shrink-0">
          <DialogClose asChild>
            <Button variant="outline" size="sm">Cancel</Button>
          </DialogClose>
          <Button size="sm" onClick={handleSubmit} disabled={!canSubmit}>
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Template Card ────────────────────────────────────────────────────────────

function TemplateCard({
  template,
  onEdit,
  onDelete,
  onDuplicate,
}: {
  template: HtmlTemplate;
  onEdit: (t: HtmlTemplate) => void;
  onDelete: (t: HtmlTemplate) => void;
  onDuplicate: (t: HtmlTemplate) => void;
}) {
  return (
    <Card className="overflow-hidden">
      {/* Preview */}
      <div className="bg-black border-b">
        <TemplatePreview
          html={template.htmlContent}
          dimensions={template.dimensions}
          className="w-full"
        />
      </div>

      {/* Info */}
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-semibold truncate">{template.name}</h3>
            {template.description && (
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                {template.description}
              </p>
            )}
          </div>
          <Badge variant="outline" className="text-[10px] shrink-0">
            {template.dimensions.width}×{template.dimensions.height}
          </Badge>
        </div>

        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="h-7 text-xs flex-1" onClick={() => onEdit(template)}>
            <Pencil className="mr-1 h-3 w-3" />Edit
          </Button>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => onDuplicate(template)}>
            <Copy className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => onDelete(template)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function TemplatesClient() {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<HtmlTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<HtmlTemplate | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<HtmlTemplate | null>(null);

  const fetchTemplates = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch('/api/templates');
      const data = await res.json();
      if (data.success) setTemplates(data.data ?? []);
    } catch {
      // Silent
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Create or Update
  const handleSave = async (formData: {
    name: string;
    description?: string;
    htmlContent: string;
    dimensions: { width: number; height: number };
  }) => {
    setSaving(true);
    try {
      if (editingTemplate) {
        await fetch('/api/templates', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateId: editingTemplate.id, ...formData }),
        });
      } else {
        await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formData),
        });
      }
      setDialogOpen(false);
      setEditingTemplate(undefined);
      fetchTemplates();
    } catch {
      // TODO: toast
    } finally {
      setSaving(false);
    }
  };

  // Duplicate
  const handleDuplicate = async (t: HtmlTemplate) => {
    setSaving(true);
    try {
      await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${t.name} (Copy)`,
          description: t.description,
          htmlContent: t.htmlContent,
          dimensions: t.dimensions,
        }),
      });
      fetchTemplates();
    } catch {
      // TODO: toast
    } finally {
      setSaving(false);
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`/api/templates?id=${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      fetchTemplates();
    } catch {
      // TODO: toast
    }
  };

  const openCreate = () => {
    setEditingTemplate(undefined);
    setDialogOpen(true);
  };

  const openEdit = (t: HtmlTemplate) => {
    setEditingTemplate(t);
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Templates</h1>
          <p className="text-sm text-muted-foreground mt-1">
            HTML design templates the AI uses as visual style references.
          </p>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          New Template
        </Button>
      </div>

      {/* Template Grid */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="overflow-hidden">
              <Skeleton className="h-48 w-full" />
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="rounded-full bg-secondary p-4 mb-4">
              <Code2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-sm font-semibold">No templates yet</h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Create a template by pasting sample HTML. The AI will match its colors, fonts,
              and layout when generating infographic cards.
            </p>
            <Button size="sm" className="mt-4" onClick={openCreate}>
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Create your first template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <TemplateCard
              key={t.id}
              template={t}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
              onDuplicate={handleDuplicate}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <TemplateDialog
        template={editingTemplate}
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setEditingTemplate(undefined);
        }}
        onSave={handleSave}
        saving={saving}
      />

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Are you sure you want to delete &ldquo;{deleteTarget?.name}&rdquo;? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
