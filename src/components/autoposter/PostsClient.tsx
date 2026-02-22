'use client';

/**
 * PostsClient — LinkedIn post creation & management.
 *
 * ALL content is AI-generated. Two creation workflows:
 *   1. Post Now — AI generates content → user reviews → publish to LinkedIn instantly
 *   2. Schedule — AI generates content → saved for review → publishes at scheduled time
 *
 * Content type (text / image / video) determines what AI produces.
 */

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  CheckCircle2, XCircle, RotateCcw, PenLine, Send, Clock,
  SkipForward, AlertCircle, Eye, FileText, Image as ImageIcon, Video, Code2,
  Sparkles, Zap, CalendarClock, Loader2, Settings2, ChevronDown, ChevronUp,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  getModels, getDefaultModel, PROVIDERS, ASPECT_RATIOS,
  IMAGE_SIZES, VIDEO_RESOLUTIONS, VIDEO_DURATIONS,
} from '@/components/ai-test/catalog';
import type { TestProvider, TestCapability, ModelOption } from '@/components/ai-test/types';
import type { Post, PostStatus, PostMediaType, Series, HtmlTemplate } from '@/lib/linkedin/types';
import html2canvas from 'html2canvas';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(d: Date | string) {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatDateTime(d: Date | string) {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

function toLocalDatetimeValue(d: Date | string) {
  const date = typeof d === 'string' ? new Date(d) : d;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const STATUS_CONFIG: Record<PostStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ComponentType<{ className?: string }> }> = {
  pending_review: { label: 'Needs Review', variant: 'default', icon: PenLine },
  approved:       { label: 'Approved',     variant: 'secondary', icon: CheckCircle2 },
  published:      { label: 'Published',    variant: 'secondary', icon: Send },
  rejected:       { label: 'Rejected',     variant: 'destructive', icon: XCircle },
  skipped:        { label: 'Skipped',      variant: 'outline', icon: SkipForward },
  failed:         { label: 'Failed',       variant: 'destructive', icon: AlertCircle },
};

const MEDIA_ICONS: Record<PostMediaType, React.ComponentType<{ className?: string }>> = {
  text: FileText,
  image: ImageIcon,
  video: Video,
  html: Code2,
};

// ── HTML Dimension Parser ─────────────────────────────────────────────────────

/**
 * Extract width/height from the HTML's inline CSS.
 * Looks for patterns like `width: 1080px` and `height: 1080px` in `html` or `body` rules.
 * Returns defaults if not found.
 */
function parseHtmlDimensions(html: string): { width: number; height: number | null } {
  // Match width/height from CSS rules targeting html/body
  const wMatch = html.match(/(?:html|body)\s*[^}]*?width\s*:\s*(\d+)px/);
  const hMatch = html.match(/(?:html|body)\s*[^}]*?height\s*:\s*(\d+)px/);
  const width = wMatch ? parseInt(wMatch[1], 10) : 1080;
  // If overflow is visible or no height set, treat as auto
  const hasOverflowVisible = /(?:html|body)\s*[^}]*?overflow\s*:\s*visible/.test(html);
  const height = hasOverflowVisible ? null : (hMatch ? parseInt(hMatch[1], 10) : null);
  return { width, height };
}

// ── HTML Preview Component ────────────────────────────────────────────────────

/**
 * Render AI-generated HTML in a sandboxed iframe.
 * Reads dimensions from the HTML's CSS — supports both fixed-size and auto-height cards.
 */
function HtmlPreview({ html, className }: { html: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [scale, setScale] = useState(0);
  const [iframeHeight, setIframeHeight] = useState<number>(0);

  const { width: designW, height: designH } = useMemo(() => parseHtmlDimensions(html), [html]);
  const isAutoHeight = designH === null;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateScale = () => setScale(el.clientWidth / designW);
    updateScale();
    const ro = new ResizeObserver(updateScale);
    ro.observe(el);
    return () => ro.disconnect();
  }, [designW]);

  // For auto-height: measure iframe content after load
  const handleIframeLoad = useCallback(() => {
    if (!isAutoHeight) return;
    const doc = iframeRef.current?.contentDocument;
    if (!doc?.body) return;
    // Give styles a moment to render
    setTimeout(() => {
      const h = doc.documentElement.scrollHeight || doc.body.scrollHeight;
      setIframeHeight(h);
    }, 150);
  }, [isAutoHeight]);

  const actualH = isAutoHeight ? (iframeHeight || 800) : designH;
  const containerH = scale > 0 ? Math.ceil(actualH * scale) : 300;

  return (
    <div
      ref={containerRef}
      className={cn('rounded-lg border overflow-hidden bg-black', className)}
      style={{ height: containerH, position: 'relative' }}
    >
      {scale > 0 && (
        <iframe
          ref={iframeRef}
          srcDoc={html}
          sandbox="allow-same-origin"
          title="HTML Card Preview"
          onLoad={handleIframeLoad}
          style={{
            width: designW,
            height: actualH,
            border: 'none',
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        />
      )}
    </div>
  );
}

/**
 * Capture HTML content as a PNG base64 string using html2canvas.
 * Reads dimensions from the HTML — supports both fixed-size and auto-height cards.
 */
async function captureHtmlAsBase64(html: string): Promise<string> {
  const { width: designW, height: designH } = parseHtmlDimensions(html);

  return new Promise((resolve, reject) => {
    const iframe = document.createElement('iframe');
    // For auto-height, use a tall initial height to let content flow
    const capH = designH ?? 2000;
    iframe.style.cssText = `position:fixed;left:-9999px;top:0;width:${designW}px;height:${capH}px;border:none;`;
    iframe.sandbox.add('allow-same-origin');
    iframe.srcdoc = html;

    iframe.onload = async () => {
      try {
        await new Promise(r => setTimeout(r, 200));

        const body = iframe.contentDocument?.body;
        if (!body) throw new Error('Cannot access iframe content');

        // For auto-height, use actual content height
        const finalH = designH ?? (iframe.contentDocument!.documentElement.scrollHeight || capH);

        const canvas = await html2canvas(body, {
          width: designW,
          height: finalH,
          scale: 2,
          useCORS: true,
          backgroundColor: '#0f172a',
        });

        const dataUrl = canvas.toDataURL('image/png');
        const base64 = dataUrl.split(',')[1];
        resolve(base64);
      } catch (err) {
        reject(err);
      } finally {
        document.body.removeChild(iframe);
      }
    };

    iframe.onerror = () => {
      document.body.removeChild(iframe);
      reject(new Error('Failed to load HTML in iframe'));
    };

    document.body.appendChild(iframe);
  });
}

// ── Content Type Selector ────────────────────────────────────────────────────

function ContentTypeSelector({
  value, onChange, disabled,
}: {
  value: PostMediaType;
  onChange: (v: PostMediaType) => void;
  disabled?: boolean;
}) {
  const options: { value: PostMediaType; label: string; icon: React.ComponentType<{ className?: string }>; desc: string }[] = [
    { value: 'text',  label: 'Text',      icon: FileText,  desc: 'Text-only post' },
    { value: 'image', label: 'Image',     icon: ImageIcon, desc: 'AI generates an image' },
    { value: 'video', label: 'Video',     icon: Video,     desc: 'AI generates a short video' },
    { value: 'html',  label: 'HTML Card', icon: Code2,     desc: 'Template card image' },
  ];

  return (
    <div className="space-y-1.5">
      <Label>Content Type</Label>
      <div className="grid grid-cols-4 gap-2">
        {options.map((opt) => {
          const Icon = opt.icon;
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.value)}
              className={cn(
                'flex flex-col items-center gap-1 rounded-lg border p-3 text-xs transition-colors',
                active
                  ? 'border-primary bg-primary/5 text-foreground'
                  : 'border-border text-muted-foreground hover:bg-secondary/50',
                disabled && 'opacity-50 cursor-not-allowed',
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="font-medium">{opt.label}</span>
              <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Shared form fields for topic + notes + content type + model control ───────

interface GenerationFormData {
  topic: string;
  notes: string;
  seriesId: string;
  mediaType: PostMediaType;
  // Template (for HTML content type)
  templateId: string;
  // Model control
  provider: TestProvider;
  textModel: string;
  imageModel: string;
  videoModel: string;
  temperature: string; // stored as string for input binding
  maxTokens: string;
  // Media config
  aspectRatio: string;
  imageSize: string;
  numberOfImages: string;
  durationSeconds: string;
  videoResolution: string;
  negativePrompt: string;
}

const DEFAULT_FORM: GenerationFormData = {
  topic: '', notes: '', seriesId: '', mediaType: 'html',
  templateId: '',
  provider: 'gemini',
  textModel: 'gemini-3.1-pro-preview',
  imageModel: getDefaultModel('gemini', 'image'),
  videoModel: getDefaultModel('gemini', 'video'),
  temperature: '', maxTokens: '',
  aspectRatio: '', imageSize: '', numberOfImages: '',
  durationSeconds: '', videoResolution: '', negativePrompt: '',
};

/** Map PostMediaType → TestCapability. HTML uses the text model pipeline. */
function toCapability(mt: PostMediaType): TestCapability {
  if (mt === 'html') return 'text';
  return mt as TestCapability;
}

function GenerationFields({
  form, setForm, seriesList, templates, disabled, showSeries = false,
}: {
  form: GenerationFormData;
  setForm: React.Dispatch<React.SetStateAction<GenerationFormData>>;
  seriesList: Series[];
  templates: HtmlTemplate[];
  disabled: boolean;
  showSeries?: boolean;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const textModels = getModels(form.provider, 'text');
  const imageModels = getModels(form.provider, 'image');
  const videoModels = getModels(form.provider, 'video');

  // When provider changes, reset models to defaults
  const handleProviderChange = (p: TestProvider) => {
    setForm(f => ({
      ...f,
      provider: p,
      textModel: getDefaultModel(p, 'text'),
      imageModel: getDefaultModel(p, 'image'),
      videoModel: getDefaultModel(p, 'video'),
    }));
  };

  // When mediaType changes, ensure model is set
  const handleMediaTypeChange = (mt: PostMediaType) => {
    setForm(f => {
      const cap = toCapability(mt);
      const isText = mt === 'text' || mt === 'html';
      const currentModel = isText ? f.textModel : mt === 'image' ? f.imageModel : f.videoModel;
      const models = getModels(f.provider, cap);
      const valid = models.some(m => m.id === currentModel);
      if (!valid) {
        const key = isText ? 'textModel' : mt === 'image' ? 'imageModel' : 'videoModel';
        return { ...f, mediaType: mt, [key]: getDefaultModel(f.provider, cap) };
      }
      return { ...f, mediaType: mt };
    });
  };

  /** The model list that corresponds to the currently active content type */
  const activeModels = (form.mediaType === 'text' || form.mediaType === 'html') ? textModels : form.mediaType === 'image' ? imageModels : videoModels;
  const activeModelKey = (form.mediaType === 'text' || form.mediaType === 'html') ? 'textModel' : form.mediaType === 'image' ? 'imageModel' : 'videoModel';
  const activeModelValue = form[activeModelKey as keyof GenerationFormData] as string;
  const selectedModelInfo = activeModels.find(m => m.id === activeModelValue);

  return (
    <>
      {/* Topic */}
      <div className="space-y-1.5">
        <Label htmlFor="gen-topic">Topic <span className="text-destructive">*</span></Label>
        <Input
          id="gen-topic"
          placeholder="e.g. Why async communication beats meetings"
          value={form.topic}
          onChange={(e) => setForm(f => ({ ...f, topic: e.target.value }))}
          disabled={disabled}
        />
      </div>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label htmlFor="gen-notes">Notes <span className="text-xs text-muted-foreground">(optional — key points, angle, personal story)</span></Label>
        <Textarea
          id="gen-notes"
          placeholder="Include specific points, examples, or an angle you want the AI to take…"
          rows={3}
          value={form.notes}
          onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))}
          disabled={disabled}
        />
      </div>

      {/* Content Type */}
      <ContentTypeSelector
        value={form.mediaType}
        onChange={handleMediaTypeChange}
        disabled={disabled}
      />

      {/* Template selector — shown when HTML is selected */}
      {form.mediaType === 'html' && templates.length > 0 && (
        <div className="space-y-1.5">
          <Label>Template <span className="text-xs text-muted-foreground">(style reference for the AI)</span></Label>
          <Select
            value={form.templateId || '_none'}
            onValueChange={(v) => setForm(f => ({ ...f, templateId: v === '_none' ? '' : v }))}
            disabled={disabled}
          >
            <SelectTrigger><SelectValue placeholder="No template (default style)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_none">No template (default style)</SelectItem>
              {templates.map(t => (
                <SelectItem key={t.id} value={t.id}>
                  <span className="font-medium">{t.name}</span>
                  <span className="text-[10px] text-muted-foreground ml-1.5">
                    ({t.dimensions.width}×{t.dimensions.height})
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Series */}
      {showSeries && seriesList.length > 0 && (
        <div className="space-y-1.5">
          <Label>Series <span className="text-xs text-muted-foreground">(optional)</span></Label>
          <Select
            value={form.seriesId}
            onValueChange={(v) => setForm(f => ({ ...f, seriesId: v === 'none' ? '' : v }))}
            disabled={disabled}
          >
            <SelectTrigger><SelectValue placeholder="No series" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No series (standalone)</SelectItem>
              {seriesList.map(s => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Advanced — Model Control */}
      <button
        type="button"
        onClick={() => setShowAdvanced(v => !v)}
        disabled={disabled}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
      >
        <Settings2 className="h-3.5 w-3.5" />
        AI Model &amp; Settings
        {showAdvanced ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </button>

      {showAdvanced && (
        <div className="space-y-3 rounded-lg border p-3 bg-muted/30">
          {/* Provider */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Provider</Label>
            <Select value={form.provider} onValueChange={(v) => handleProviderChange(v as TestProvider)} disabled={disabled}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROVIDERS.map(p => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Text Model (always shown — text is always generated) */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Text Model</Label>
            <Select value={form.textModel} onValueChange={(v) => setForm(f => ({ ...f, textModel: v }))} disabled={disabled}>
              <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {textModels.map((m: ModelOption) => (
                  <SelectItem key={m.id} value={m.id}>
                    <span className="font-medium">{m.label}</span>
                    <span className="text-[10px] text-muted-foreground ml-1.5">({m.vendor})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Image Model — shown when image is selected */}
          {form.mediaType === 'image' && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Image Model</Label>
              <Select value={form.imageModel} onValueChange={(v) => setForm(f => ({ ...f, imageModel: v }))} disabled={disabled}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {imageModels.map((m: ModelOption) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="font-medium">{m.label}</span>
                      <span className="text-[10px] text-muted-foreground ml-1.5">({m.vendor})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Video Model — shown when video is selected */}
          {form.mediaType === 'video' && (
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Video Model</Label>
              <Select value={form.videoModel} onValueChange={(v) => setForm(f => ({ ...f, videoModel: v }))} disabled={disabled}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {videoModels.map((m: ModelOption) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="font-medium">{m.label}</span>
                      <span className="text-[10px] text-muted-foreground ml-1.5">({m.vendor})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Selected model info */}
          {selectedModelInfo && (
            <div className="rounded-md border bg-card p-2.5 space-y-1">
              <p className="text-[10px] font-mono text-muted-foreground truncate">{selectedModelInfo.id}</p>
              <p className="text-xs text-foreground/80">{selectedModelInfo.description}</p>
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="text-[9px] px-1.5">{selectedModelInfo.vendor}</Badge>
                <span className="text-[10px] text-muted-foreground">{selectedModelInfo.pricing}</span>
              </div>
            </div>
          )}

          {/* Temperature + Max Tokens */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Temperature <span className="opacity-60">(0–2)</span></Label>
              <Input
                type="number" min={0} max={2} step={0.1} placeholder="Auto"
                value={form.temperature}
                onChange={(e) => setForm(f => ({ ...f, temperature: e.target.value }))}
                disabled={disabled}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Max Tokens</Label>
              <Input
                type="number" min={1} max={8192} placeholder="1024"
                value={form.maxTokens}
                onChange={(e) => setForm(f => ({ ...f, maxTokens: e.target.value }))}
                disabled={disabled}
                className="h-8 text-sm"
              />
            </div>
          </div>

          {/* Image-specific options */}
          {form.mediaType === 'image' && (
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Aspect Ratio</Label>
                <Select value={form.aspectRatio || '_auto'} onValueChange={(v) => setForm(f => ({ ...f, aspectRatio: v === '_auto' ? '' : v }))} disabled={disabled}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Auto" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_auto">Auto (1:1)</SelectItem>
                    {ASPECT_RATIOS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Image Size</Label>
                <Select value={form.imageSize || '_auto'} onValueChange={(v) => setForm(f => ({ ...f, imageSize: v === '_auto' ? '' : v }))} disabled={disabled}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Auto" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_auto">Auto (1K)</SelectItem>
                    {IMAGE_SIZES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground"># Images</Label>
                <Input
                  type="number" min={1} max={4} placeholder="1"
                  value={form.numberOfImages}
                  onChange={(e) => setForm(f => ({ ...f, numberOfImages: e.target.value }))}
                  disabled={disabled}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          )}

          {/* Video-specific options */}
          {form.mediaType === 'video' && (
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Aspect Ratio</Label>
                <Select value={form.aspectRatio || '_auto'} onValueChange={(v) => setForm(f => ({ ...f, aspectRatio: v === '_auto' ? '' : v }))} disabled={disabled}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Auto" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_auto">Auto (16:9)</SelectItem>
                    {ASPECT_RATIOS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Duration</Label>
                <Select value={form.durationSeconds || '_auto'} onValueChange={(v) => setForm(f => ({ ...f, durationSeconds: v === '_auto' ? '' : v }))} disabled={disabled}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Auto" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_auto">Auto (6s)</SelectItem>
                    {VIDEO_DURATIONS.map(d => <SelectItem key={d} value={String(d)}>{d}s</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Resolution</Label>
                <Select value={form.videoResolution || '_auto'} onValueChange={(v) => setForm(f => ({ ...f, videoResolution: v === '_auto' ? '' : v }))} disabled={disabled}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Auto" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_auto">Auto</SelectItem>
                    {VIDEO_RESOLUTIONS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Negative prompt (image/video) */}
          {(form.mediaType === 'image' || form.mediaType === 'video') && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Negative Prompt <span className="opacity-60">(what to avoid)</span></Label>
              <Input
                placeholder="blurry, low quality, watermark, text…"
                value={form.negativePrompt}
                onChange={(e) => setForm(f => ({ ...f, negativePrompt: e.target.value }))}
                disabled={disabled}
                className="h-8 text-sm"
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST NOW DIALOG  — AI generates → review → publish immediately
// ═══════════════════════════════════════════════════════════════════════════════

/** Extract model control + media config from form into API payload fields */
function buildModelPayload(form: GenerationFormData) {
  return {
    provider: form.provider || undefined,
    templateId: form.templateId || undefined,
    textModel: form.textModel || undefined,
    imageModel: form.mediaType === 'image' ? (form.imageModel || undefined) : undefined,
    videoModel: form.mediaType === 'video' ? (form.videoModel || undefined) : undefined,
    temperature: form.temperature ? parseFloat(form.temperature) : undefined,
    maxTokens: form.maxTokens ? parseInt(form.maxTokens) : undefined,
    aspectRatio: form.aspectRatio || undefined,
    imageSize: form.imageSize || undefined,
    numberOfImages: form.numberOfImages ? parseInt(form.numberOfImages) : undefined,
    durationSeconds: form.durationSeconds ? parseInt(form.durationSeconds) : undefined,
    videoResolution: form.videoResolution || undefined,
    negativePrompt: form.negativePrompt.trim() || undefined,
  };
}

interface PostNowDialogProps {
  seriesList: Series[];
  templates: HtmlTemplate[];
  onDone: () => void;
}

function PostNowDialog({ seriesList, templates, onDone }: PostNowDialogProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'input' | 'review'>('input');
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState<GenerationFormData>({ ...DEFAULT_FORM });

  // After generation
  const [draft, setDraft] = useState<{ postId: string; content: string; summary: string; mediaUrl?: string; htmlContent?: string } | null>(null);
  const [editedContent, setEditedContent] = useState('');
  const [editing, setEditing] = useState(false);

  const reset = () => {
    setStep('input');
    setForm({ ...DEFAULT_FORM });
    setDraft(null);
    setEditedContent('');
    setEditing(false);
    setError('');
  };

  const busy = generating || publishing;

  // Step 1: Generate AI content
  const handleGenerate = async () => {
    if (!form.topic.trim()) { setError('Topic is required.'); return; }
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'instant',
          topic: form.topic.trim(),
          notes: form.notes.trim() || undefined,
          seriesId: form.seriesId || undefined,
          mediaType: form.mediaType,
          ...buildModelPayload(form),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? 'Generation failed');
      setDraft({
        postId: data.data.postId,
        content: data.data.content,
        summary: data.data.summary,
        mediaUrl: data.data.media?.url,
        htmlContent: data.data.htmlContent,
      });
      setEditedContent(data.data.content);
      setStep('review');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setGenerating(false);
    }
  };

  // Step 2: Publish to LinkedIn
  const handlePublish = async () => {
    if (!draft) return;
    setPublishing(true);
    setError('');
    try {
      // For HTML posts: convert the HTML to PNG on the client before publishing
      let imageBase64: string | undefined;
      if (form.mediaType === 'html' && draft.htmlContent) {
        try {
          imageBase64 = await captureHtmlAsBase64(draft.htmlContent);
        } catch (captureErr) {
          setError(`Failed to capture HTML card as image: ${captureErr instanceof Error ? captureErr.message : 'Unknown error'}`);
          setPublishing(false);
          return;
        }
      }

      const contentToPublish = editing ? editedContent : draft.content;
      const res = await fetch('/api/posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postId: draft.postId,
          action: 'publish',
          editedContent: contentToPublish !== draft.content ? contentToPublish : undefined,
          imageBase64,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? 'Publish failed');
      onDone();
      setOpen(false);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Publishing failed.');
    } finally {
      setPublishing(false);
    }
  };

  // Regenerate (if user doesn't like the first draft)
  const handleRegenerate = async () => {
    if (!draft) return;
    setGenerating(true);
    setError('');
    try {
      const res = await fetch('/api/posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: draft.postId, action: 'regenerate' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? 'Regeneration failed');
      setDraft(d => d ? ({ ...d, content: data.data.content, htmlContent: data.data.htmlContent ?? d.htmlContent }) : d);
      setEditedContent(data.data.content);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Regeneration failed.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Zap className="mr-1.5 h-4 w-4" />
          Post Now
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl flex flex-col max-h-[90dvh]">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>
            {step === 'input' ? 'Generate & Post Now' : 'Review AI Draft'}
          </DialogTitle>
          <DialogDescription>
            {step === 'input'
              ? 'Tell the AI what to write. It will generate text' + (form.mediaType !== 'text' ? ` + ${form.mediaType}` : '') + ' for you to review before publishing.'
              : 'Review the generated content. Edit if needed, then publish to LinkedIn.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'input' ? (
          <>
            <div className="space-y-4 py-2 overflow-y-auto flex-1 min-h-0 pr-1">
              <GenerationFields
                form={form}
                setForm={setForm}
                seriesList={seriesList}
                templates={templates}
                disabled={generating}
                showSeries
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter className="flex-shrink-0">
              <Button variant="outline" onClick={() => { setOpen(false); reset(); }} disabled={generating}>
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={generating || !form.topic.trim()}>
                {generating ? (
                  <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Generating…</>
                ) : (
                  <><Sparkles className="mr-1.5 h-4 w-4" />Generate Content</>
                )}
              </Button>
            </DialogFooter>
          </>
        ) : draft && (
          <>
            <div className="space-y-3 py-2 overflow-y-auto flex-1 min-h-0 pr-1">
              {/* HTML card preview */}
              {draft.htmlContent && form.mediaType === 'html' && (
                <HtmlPreview html={draft.htmlContent} />
              )}

              {/* Media preview (image / video) */}
              {!draft.htmlContent && draft.mediaUrl && (
                <div className="rounded-lg border overflow-hidden">
                  {form.mediaType === 'image' ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={draft.mediaUrl} alt="Generated" className="w-full max-h-64 object-cover" />
                  ) : form.mediaType === 'video' ? (
                    <video src={draft.mediaUrl} controls className="w-full max-h-64" />
                  ) : null}
                </div>
              )}

              {/* Content */}
              {editing ? (
                <Textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  rows={14}
                  className="font-mono text-sm resize-none"
                  disabled={busy}
                />
              ) : (
                <div className="rounded-lg border bg-secondary/30 p-4 max-h-[50vh] overflow-y-auto">
                  <p className="text-sm leading-relaxed whitespace-pre-line">{editedContent}</p>
                </div>
              )}

              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <DialogFooter className="flex-wrap gap-2 flex-shrink-0">
              {editing ? (
                <>
                  <Button variant="outline" onClick={() => { setEditedContent(draft.content); setEditing(false); }} disabled={busy}>
                    Revert
                  </Button>
                  <Button variant="outline" onClick={() => setEditing(false)} disabled={busy}>
                    Done Editing
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setEditing(true)} disabled={busy}>
                    <PenLine className="mr-1.5 h-3.5 w-3.5" />Edit
                  </Button>
                  <Button variant="outline" onClick={handleRegenerate} disabled={busy}>
                    {generating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="mr-1.5 h-3.5 w-3.5" />}
                    Regenerate
                  </Button>
                </>
              )}
              <Button onClick={handlePublish} disabled={busy || !editedContent.trim()}>
                {publishing ? (
                  <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Publishing…</>
                ) : (
                  <><Send className="mr-1.5 h-4 w-4" />Publish to LinkedIn</>
                )}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULE DIALOG — AI generates → saved for later review/publish
// ═══════════════════════════════════════════════════════════════════════════════

interface ScheduleDialogProps {
  seriesList: Series[];
  templates: HtmlTemplate[];
  onCreated: (draft: { postId: string; content: string; summary: string; htmlContent?: string; mediaType?: PostMediaType }) => void;
}

function ScheduleDialog({ seriesList, templates, onCreated }: ScheduleDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState<GenerationFormData>({ ...DEFAULT_FORM });

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);
  const deadline = new Date(tomorrow);
  deadline.setHours(9, 0, 0, 0);

  const [schedule, setSchedule] = useState({
    scheduledFor: toLocalDatetimeValue(tomorrow),
    reviewDeadline: toLocalDatetimeValue(deadline),
  });

  const reset = () => {
    setForm({ ...DEFAULT_FORM });
    setSchedule({
      scheduledFor: toLocalDatetimeValue(tomorrow),
      reviewDeadline: toLocalDatetimeValue(deadline),
    });
    setError('');
  };

  const handleSubmit = async () => {
    if (!form.topic.trim()) { setError('Topic is required.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'scheduled',
          topic: form.topic.trim(),
          notes: form.notes.trim() || undefined,
          seriesId: form.seriesId || undefined,
          mediaType: form.mediaType,
          ...buildModelPayload(form),
          scheduledFor: new Date(schedule.scheduledFor).toISOString(),
          reviewDeadline: new Date(schedule.reviewDeadline).toISOString(),
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error ?? 'Failed');
      onCreated(data.data);
      setOpen(false);
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <CalendarClock className="mr-1.5 h-4 w-4" />
          Schedule Post
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl flex flex-col max-h-[90dvh]">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Schedule AI Post</DialogTitle>
          <DialogDescription>
            AI generates the content now. You review it before the scheduled publish time.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2 overflow-y-auto flex-1 min-h-0 pr-1">
          <GenerationFields
            form={form}
            setForm={setForm}
            seriesList={seriesList}
            templates={templates}
            disabled={loading}
            showSeries
          />

          <Separator />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Publish at</Label>
              <Input
                type="datetime-local"
                value={schedule.scheduledFor}
                onChange={(e) => setSchedule(s => ({ ...s, scheduledFor: e.target.value }))}
                disabled={loading}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Review by</Label>
              <Input
                type="datetime-local"
                value={schedule.reviewDeadline}
                onChange={(e) => setSchedule(s => ({ ...s, reviewDeadline: e.target.value }))}
                disabled={loading}
              />
            </div>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <DialogFooter className="flex-shrink-0">
          <Button variant="outline" onClick={() => { setOpen(false); reset(); }} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !form.topic.trim()}>
            {loading ? (
              <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Generating…</>
            ) : (
              <><Sparkles className="mr-1.5 h-4 w-4" />Generate &amp; Schedule</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// DRAFT RESULT DIALOG — shown after scheduled generation completes
// ═══════════════════════════════════════════════════════════════════════════════

interface DraftResultDialogProps {
  draft: { postId: string; content: string; summary: string; htmlContent?: string; mediaType?: PostMediaType } | null;
  onClose: () => void;
  onRefresh: () => void;
}

function DraftResultDialog({ draft, onClose, onRefresh }: DraftResultDialogProps) {
  const [editMode, setEditMode] = useState(false);
  const [content, setContent] = useState(draft?.content ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setContent(draft?.content ?? '');
    setEditMode(false);
    setError('');
  }, [draft]);

  if (!draft) return null;

  const act = async (action: string, c?: string) => {
    setBusy(true);
    setError('');
    try {
      // For publish action on HTML posts: convert HTML→PNG client-side first
      let imageBase64: string | undefined;
      if (action === 'publish' && draft.mediaType === 'html' && draft.htmlContent) {
        try {
          imageBase64 = await captureHtmlAsBase64(draft.htmlContent);
        } catch (captureErr) {
          setError(`Failed to capture HTML card as image: ${captureErr instanceof Error ? captureErr.message : 'Unknown error'}`);
          setBusy(false);
          return;
        }
      }

      const res = await fetch('/api/posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: draft.postId, action, editedContent: c, imageBase64 }),
      });
      const data = await res.json();
      if (!data.success && data.error) { setError(data.error); setBusy(false); return; }
      onRefresh();
      if (['approve', 'reject', 'publish'].includes(action)) onClose();
    } catch {
      setError('Action failed');
    }
    setBusy(false);
  };

  return (
    <Dialog open={!!draft} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Draft Generated!</DialogTitle>
          <DialogDescription>
            Review the AI-generated content. Approve for scheduled publish, or publish now.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* HTML card preview */}
          {draft.htmlContent && draft.mediaType === 'html' && (
            <HtmlPreview html={draft.htmlContent} />
          )}

          {draft.summary && (
            <p className="text-xs text-muted-foreground border rounded-md px-3 py-2 bg-secondary/30">
              <span className="font-medium">Summary:</span> {draft.summary}
            </p>
          )}
          {editMode ? (
            <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={14} className="font-mono text-sm resize-none" disabled={busy} />
          ) : (
            <div className="rounded-lg border bg-secondary/30 p-4 max-h-[50vh] overflow-y-auto">
              <p className="text-sm leading-relaxed whitespace-pre-line">{content}</p>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="flex-wrap gap-2">
          {editMode ? (
            <>
              <Button variant="outline" onClick={() => { setContent(draft.content); setEditMode(false); }} disabled={busy}>Revert</Button>
              <Button variant="outline" onClick={() => setEditMode(false)} disabled={busy}>Done Editing</Button>
            </>
          ) : (
            <Button variant="outline" onClick={() => setEditMode(true)} disabled={busy}>
              <PenLine className="mr-1.5 h-3.5 w-3.5" />Edit
            </Button>
          )}
          <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => act('reject')} disabled={busy}>
            <XCircle className="mr-1.5 h-3.5 w-3.5" />Reject
          </Button>
          <Button variant="outline" onClick={() => act('approve', editMode ? content : undefined)} disabled={busy}>
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Approve
          </Button>
          <Button onClick={() => act('publish', editMode ? content : undefined)} disabled={busy || !content.trim()}>
            <Send className="mr-1.5 h-4 w-4" />Publish Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST PREVIEW DIALOG
// ═══════════════════════════════════════════════════════════════════════════════

interface PostPreviewDialogProps {
  post: Post;
  onAction: (postId: string, action: string, content?: string) => Promise<void>;
}

function PostPreviewDialog({ post, onAction }: PostPreviewDialogProps) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.editedContent ?? post.content);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const displayContent = post.editedContent ?? post.content;
  const isPending = post.status === 'pending_review';
  const isApproved = post.status === 'approved';
  const MediaIcon = MEDIA_ICONS[post.mediaType ?? 'text'];

  const handleDelete = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/posts?postId=${post.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? 'Delete failed');
      } else {
        setOpen(false);
        await onAction(post.id, 'delete');
      }
    } catch {
      setError('Delete failed');
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  const act = async (action: string, content?: string) => {
    setBusy(true);
    setError('');
    try {
      // For publish action on HTML posts: convert HTML→PNG client-side first
      let imageBase64: string | undefined;
      if (action === 'publish' && post.mediaType === 'html' && post.htmlContent) {
        try {
          imageBase64 = await captureHtmlAsBase64(post.htmlContent);
        } catch (captureErr) {
          setError(`Failed to capture HTML card as image: ${captureErr instanceof Error ? captureErr.message : 'Unknown error'}`);
          setBusy(false);
          return;
        }
      }

      const res = await fetch('/api/posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, action, editedContent: content, imageBase64 }),
      });
      const data = await res.json();
      if (!data.success && data.error) setError(data.error);
      else {
        await onAction(post.id, action, content);
        if (['approve', 'reject', 'publish'].includes(action)) setOpen(false);
      }
    } catch {
      setError('Action failed');
    }
    setBusy(false);
    if (action === 'regenerate') setDraft(post.editedContent ?? post.content);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
          <Eye className="h-3.5 w-3.5" /><span className="sr-only">View post</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="pr-8">{post.topic}</DialogTitle>
          <DialogDescription className="flex items-center gap-1.5">
            {formatDateTime(post.scheduledFor)}
            {isPending && ` · Review by ${formatDateTime(post.reviewDeadline)}`}
            <span className="inline-flex items-center gap-1 ml-1">· <MediaIcon className="h-3 w-3" /> {post.mediaType ?? 'text'}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* HTML preview */}
          {post.htmlContent && post.mediaType === 'html' && (
            <HtmlPreview html={post.htmlContent} />
          )}

          {/* Media preview (image when mediaUrl exists but no htmlContent, or video) */}
          {!post.htmlContent && post.mediaUrl && (
            <div className="rounded-lg border overflow-hidden">
              {(post.mediaType === 'image' || post.mediaType === 'html') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.mediaUrl} alt="Post media" className="w-full max-h-64 object-cover" />
              ) : post.mediaType === 'video' ? (
                <video src={post.mediaUrl} controls className="w-full max-h-64" />
              ) : null}
            </div>
          )}

          {editing ? (
            <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={14} className="font-mono text-sm resize-none" disabled={busy} />
          ) : (
            <div className="rounded-lg border bg-secondary/30 p-4 max-h-[60vh] overflow-y-auto">
              <p className="text-sm leading-relaxed whitespace-pre-line">{displayContent}</p>
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter className="flex-wrap gap-2">
          {editing ? (
            <>
              <Button variant="outline" onClick={() => { setEditing(false); setDraft(displayContent); }} disabled={busy}>Cancel</Button>
              <Button onClick={async () => { await act('edit', draft); setEditing(false); }} disabled={busy || !draft.trim()}>Save Changes</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => setEditing(true)} disabled={busy}>
                <PenLine className="mr-1.5 h-3.5 w-3.5" />Edit
              </Button>
              {isPending && (
                <>
                  <Button variant="outline" onClick={() => act('regenerate')} disabled={busy}>
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />Regenerate
                  </Button>
                  <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => act('reject')} disabled={busy}>
                    <XCircle className="mr-1.5 h-3.5 w-3.5" />Reject
                  </Button>
                  <Button variant="outline" onClick={() => act('approve')} disabled={busy}>
                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Approve
                  </Button>
                </>
              )}
              {(isPending || isApproved) && (
                <Button onClick={() => act('publish')} disabled={busy}>
                  <Send className="mr-1.5 h-3.5 w-3.5" />Publish Now
                </Button>
              )}
              {post.status === 'failed' && (
                <Button variant="outline" onClick={() => act('retry')} disabled={busy}>
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />Retry
                </Button>
              )}
              {(isPending || isApproved) && (
                !confirmDelete ? (
                  <Button
                    variant="ghost"
                    className="text-muted-foreground hover:text-destructive ml-auto"
                    onClick={() => setConfirmDelete(true)}
                    disabled={busy}
                  >
                    <Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete
                  </Button>
                ) : (
                  <div className="flex items-center gap-2 ml-auto">
                    <span className="text-xs text-muted-foreground">Delete this post?</span>
                    <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)} disabled={busy}>Cancel</Button>
                    <Button variant="destructive" size="sm" onClick={handleDelete} disabled={busy}>
                      {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-1.5 h-3.5 w-3.5" />}
                      Delete
                    </Button>
                  </div>
                )
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST CARD
// ═══════════════════════════════════════════════════════════════════════════════

interface PostCardProps {
  post: Post;
  onAction: (postId: string, action: string, content?: string) => Promise<void>;
}

function PostCard({ post, onAction }: PostCardProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const statusConfig = STATUS_CONFIG[post.status] ?? { label: post.status, variant: 'outline' as const, icon: AlertCircle };
  const StatusIcon = statusConfig.icon;
  const mediaType = (post.mediaType ?? 'text') as keyof typeof MEDIA_ICONS;
  const MediaIcon = MEDIA_ICONS[mediaType] ?? MEDIA_ICONS.text;
  const displayContent = post.editedContent ?? post.content;
  const isPending = post.status === 'pending_review';
  const isApproved = post.status === 'approved';

  const act = async (action: string) => {
    setBusy(true);
    setError('');
    try {
      // For publish action on HTML posts: convert HTML→PNG client-side first
      let imageBase64: string | undefined;
      if (action === 'publish' && post.mediaType === 'html' && post.htmlContent) {
        try {
          imageBase64 = await captureHtmlAsBase64(post.htmlContent);
        } catch (captureErr) {
          setError(`Failed to capture HTML card: ${captureErr instanceof Error ? captureErr.message : 'Unknown error'}`);
          setBusy(false);
          return;
        }
      }

      const res = await fetch('/api/posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, action, imageBase64 }),
      });
      const data = await res.json();
      if (!data.success && data.error) setError(data.error);
      await onAction(post.id, action);
    } catch {
      setError('Action failed');
    }
    setBusy(false);
  };

  const handleDelete = async () => {
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/posts?postId=${post.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? 'Delete failed');
      } else {
        await onAction(post.id, 'delete');
      }
    } catch {
      setError('Delete failed');
    } finally {
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  return (
    <Card className={cn(isPending && 'ring-1 ring-primary/30')}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold truncate">{post.topic}</p>
              <Badge variant={statusConfig.variant} className="text-[10px] shrink-0 flex items-center gap-1">
                <StatusIcon className="h-3 w-3" />{statusConfig.label}
              </Badge>
              <MediaIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatDate(post.scheduledFor)}
              {isPending && ` · Review by ${formatDateTime(post.reviewDeadline)}`}
              {post.status === 'published' && post.publishedAt && ` · Published ${formatDate(post.publishedAt)}`}
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <PostPreviewDialog post={post} onAction={onAction} />
            {(isPending || isApproved) && (
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
              >
                <Trash2 className="h-3.5 w-3.5" /><span className="sr-only">Delete post</span>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 whitespace-pre-line">
          {displayContent}
        </p>

        {post.status === 'failed' && post.failureReason && (
          <p className="text-xs text-destructive flex items-start gap-1.5">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />{post.failureReason}
          </p>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}

        <div className="flex flex-wrap gap-2">
          {isPending && (
            <>
              <Button size="sm" variant="outline" onClick={() => act('approve')} disabled={busy}>
                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />Approve
              </Button>
              <Button size="sm" onClick={() => act('publish')} disabled={busy}>
                <Send className="mr-1.5 h-3.5 w-3.5" />Publish Now
              </Button>
              <Button size="sm" variant="outline" onClick={() => act('regenerate')} disabled={busy}>
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />Regenerate
              </Button>
              <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={() => act('reject')} disabled={busy}>
                <XCircle className="mr-1.5 h-3.5 w-3.5" />Reject
              </Button>
            </>
          )}
          {isApproved && (
            <Button size="sm" onClick={() => act('publish')} disabled={busy}>
              <Send className="mr-1.5 h-3.5 w-3.5" />Publish Now
            </Button>
          )}
          {post.status === 'failed' && (
            <Button size="sm" variant="outline" onClick={() => act('retry')} disabled={busy}>
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" />Retry
            </Button>
          )}
          {(isPending || isApproved) && confirmDelete && (
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-xs text-muted-foreground">Delete this post?</span>
              <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)} disabled={busy}>Cancel</Button>
              <Button size="sm" variant="destructive" onClick={handleDelete} disabled={busy}>
                {busy ? <Loader2 className="mr-1.5 h-3 w-3 animate-spin" /> : <Trash2 className="mr-1.5 h-3 w-3" />}
                Delete
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SKELETON
// ═══════════════════════════════════════════════════════════════════════════════

function PostsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <Card key={i}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5 mt-2" />
            <Skeleton className="h-3 w-2/3 mt-2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

export default function PostsClient() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [seriesList, setSeriesList] = useState<Series[]>([]);
  const [templates, setTemplates] = useState<HtmlTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDraft, setNewDraft] = useState<{ postId: string; content: string; summary: string; htmlContent?: string; mediaType?: PostMediaType } | null>(null);

  const fetchData = useCallback(async () => {
    if (!user) return;
    try {
      const [postsRes, seriesRes, templatesRes] = await Promise.all([
        fetch('/api/posts?limit=100'),
        fetch('/api/series'),
        fetch('/api/templates'),
      ]);
      const [postsData, seriesData, templatesData] = await Promise.all([
        postsRes.json(), seriesRes.json(), templatesRes.json(),
      ]);
      if (postsData.success) setPosts(postsData.data ?? []);
      if (seriesData.success) setSeriesList(seriesData.data ?? []);
      if (templatesData.success) setTemplates(templatesData.data ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = useCallback(async () => {
    await fetchData();
  }, [fetchData]);

  // Group posts
  const pending  = posts.filter(p => p.status === 'pending_review');
  const approved = posts.filter(p => p.status === 'approved');
  const history  = posts.filter(p => ['published', 'rejected', 'skipped', 'failed'].includes(p.status));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Posts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            AI generates your LinkedIn content. Choose text, image, or video.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ScheduleDialog seriesList={seriesList} templates={templates} onCreated={(d) => { setNewDraft(d); fetchData(); }} />
          <PostNowDialog seriesList={seriesList} templates={templates} onDone={fetchData} />
        </div>
      </div>

      <Separator />

      {loading ? (
        <PostsSkeleton />
      ) : (
        <Tabs defaultValue="pending">
          <TabsList className="mb-4">
            <TabsTrigger value="pending">
              Needs Review
              {pending.length > 0 && (
                <span className="ml-1.5 rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 font-medium">
                  {pending.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved">
              Ready to Publish
              {approved.length > 0 && (
                <span className="ml-1.5 rounded-full bg-secondary text-foreground text-[10px] px-1.5 py-0.5 font-medium">
                  {approved.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="space-y-3">
            {pending.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-secondary p-3 mb-4">
                    <CheckCircle2 className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">All caught up!</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                    No posts waiting for review. Use &quot;Post Now&quot; to create and publish instantly, or &quot;Schedule&quot; to plan ahead.
                  </p>
                </CardContent>
              </Card>
            ) : (
              pending.map(post => <PostCard key={post.id} post={post} onAction={handleAction} />)
            )}
          </TabsContent>

          <TabsContent value="approved" className="space-y-3">
            {approved.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-secondary p-3 mb-4">
                    <Clock className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">No approved posts</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Approve posts from the &quot;Needs Review&quot; tab to queue them for publishing.
                  </p>
                </CardContent>
              </Card>
            ) : (
              approved.map(post => <PostCard key={post.id} post={post} onAction={handleAction} />)
            )}
          </TabsContent>

          <TabsContent value="history" className="space-y-3">
            {history.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="rounded-full bg-secondary p-3 mb-4">
                    <Send className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium">No history yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Published, rejected, and skipped posts will show here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              history.map(post => <PostCard key={post.id} post={post} onAction={handleAction} />)
            )}
          </TabsContent>
        </Tabs>
      )}

      <DraftResultDialog draft={newDraft} onClose={() => setNewDraft(null)} onRefresh={fetchData} />
    </div>
  );
}
