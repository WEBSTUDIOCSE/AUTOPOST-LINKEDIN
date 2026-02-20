'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ASPECT_RATIOS, IMAGE_SIZES, VIDEO_RESOLUTIONS, VIDEO_DURATIONS } from './catalog';
import type { TestCapability, TestFormValues } from './types';

interface PromptFormProps {
  capability: TestCapability;
  values: TestFormValues;
  onChange: (patch: Partial<TestFormValues>) => void;
  onSubmit: () => void;
  loading: boolean;
}

export function PromptForm({ capability, values, onChange, onSubmit, loading }: PromptFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="space-y-4">
      {/* Main Prompt */}
      <div>
        <Label htmlFor="prompt" className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5 block">
          Prompt
        </Label>
        <textarea
          id="prompt"
          rows={4}
          maxLength={2000}
          placeholder={getPlaceholder(capability)}
          value={values.prompt}
          onChange={(e) => onChange({ prompt: e.target.value })}
          disabled={loading}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm
            placeholder:text-muted-foreground focus-visible:outline-none
            focus-visible:ring-2 focus-visible:ring-ring resize-none
            disabled:cursor-not-allowed disabled:opacity-50"
        />
        <p className="text-xs text-muted-foreground text-right mt-1">
          {values.prompt.length}/2000
        </p>
      </div>

      {/* Advanced Options Toggle */}
      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        {showAdvanced ? '▲ Hide' : '▼ Show'} advanced options
      </button>

      {showAdvanced && (
        <div className="space-y-3 rounded-md border p-3 bg-muted/30">
          {/* Text options */}
          {capability === 'text' && (
            <>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  System Instruction <span className="opacity-60">(optional)</span>
                </Label>
                <Input
                  placeholder="You are a professional LinkedIn content writer…"
                  maxLength={500}
                  value={values.systemInstruction ?? ''}
                  onChange={(e) => onChange({ systemInstruction: e.target.value })}
                  disabled={loading}
                  className="h-8 text-sm"
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Temperature <span className="opacity-60">(0–2)</span>
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={2}
                    step={0.1}
                    placeholder="1.0"
                    value={values.temperature ?? ''}
                    onChange={(e) =>
                      onChange({ temperature: e.target.value ? parseFloat(e.target.value) : undefined })
                    }
                    disabled={loading}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Max Tokens
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    max={8192}
                    placeholder="1024"
                    value={values.maxTokens ?? ''}
                    onChange={(e) =>
                      onChange({ maxTokens: e.target.value ? parseInt(e.target.value) : undefined })
                    }
                    disabled={loading}
                    className="h-8 text-sm"
                  />
                </div>
              </div>
            </>
          )}

          {/* Image/Video shared options */}
          {(capability === 'image' || capability === 'video') && (
            <>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Aspect Ratio
                </Label>
                <Select
                  value={values.aspectRatio ?? '_none'}
                  onValueChange={(v) => onChange({ aspectRatio: v === '_none' ? undefined : v })}
                  disabled={loading}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Default (auto)</SelectItem>
                    {ASPECT_RATIOS.map((r) => (
                      <SelectItem key={r} value={r}>{r}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Negative Prompt <span className="opacity-60">(optional)</span>
                </Label>
                <Input
                  placeholder="blurry, low quality, watermark…"
                  maxLength={500}
                  value={values.negativePrompt ?? ''}
                  onChange={(e) => onChange({ negativePrompt: e.target.value || undefined })}
                  disabled={loading}
                  className="h-8 text-sm"
                />
              </div>
            </>
          )}

          {/* Image-only options */}
          {capability === 'image' && (
            <div className="flex gap-3">
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Image Size
                </Label>
                <Select
                  value={values.imageSize ?? '_none'}
                  onValueChange={(v) => onChange({ imageSize: v === '_none' ? undefined : v })}
                  disabled={loading}
                >
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Default (1K)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">Default (1K)</SelectItem>
                    {IMAGE_SIZES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Number of Images
                </Label>
                <Input
                  type="number"
                  min={1}
                  max={4}
                  placeholder="1"
                  value={values.numberOfImages ?? ''}
                  onChange={(e) =>
                    onChange({ numberOfImages: e.target.value ? parseInt(e.target.value) : undefined })
                  }
                  disabled={loading}
                  className="h-8 text-sm"
                />
              </div>
            </div>
          )}

          {/* Video-only options */}
          {capability === 'video' && (
            <>
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Duration (seconds)
                  </Label>
                  <Select
                    value={values.durationSeconds?.toString() ?? '_none'}
                    onValueChange={(v) =>
                      onChange({ durationSeconds: v === '_none' ? undefined : parseInt(v) })
                    }
                    disabled={loading}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Default (8s)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Default (8s)</SelectItem>
                      {VIDEO_DURATIONS.map((d) => (
                        <SelectItem key={d} value={d.toString()}>{d}s</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    Resolution
                  </Label>
                  <Select
                    value={values.resolution ?? '_none'}
                    onValueChange={(v) => onChange({ resolution: v === '_none' ? undefined : v })}
                    disabled={loading}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Default (720p)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Default (720p)</SelectItem>
                      {VIDEO_RESOLUTIONS.map((r) => (
                        <SelectItem key={r} value={r}>{r}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Starting Image URL <span className="opacity-60">(optional, gs:// for Veo)</span>
                </Label>
                <Input
                  type="url"
                  placeholder="gs://bucket/image.jpg or https://..."
                  maxLength={500}
                  value={values.imageUrl ?? ''}
                  onChange={(e) => onChange({ imageUrl: e.target.value || undefined })}
                  disabled={loading}
                  className="h-8 text-sm"
                />
              </div>
            </>
          )}
        </div>
      )}

      <Separator />

      <Button
        onClick={onSubmit}
        disabled={loading || !values.prompt.trim()}
        className="w-full"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
            Generating…
          </span>
        ) : (
          `Generate ${capitalize(capability)}`
        )}
      </Button>
    </div>
  );
}

function getPlaceholder(capability: TestCapability): string {
  switch (capability) {
    case 'text':  return 'Write a LinkedIn post about the future of AI automation…';
    case 'image': return 'A futuristic city skyline at sunset with neon lights…';
    case 'video': return 'A drone shot flying over a mountain range at golden hour…';
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
