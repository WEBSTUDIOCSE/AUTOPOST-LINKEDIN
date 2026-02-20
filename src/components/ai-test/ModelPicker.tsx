'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { PROVIDERS, CAPABILITIES, getModels, getDefaultModel } from './catalog';
import type { TestCapability, TestProvider, ModelOption } from './types';

interface ModelPickerProps {
  provider: TestProvider;
  capability: TestCapability;
  model: string;
  onProviderChange: (p: TestProvider) => void;
  onCapabilityChange: (c: TestCapability) => void;
  onModelChange: (m: string) => void;
  disabled?: boolean;
}

const CAP_STYLES: Record<TestCapability, string> = {
  text:  'data-[active=true]:bg-violet-600 data-[active=true]:text-white data-[active=true]:border-violet-600',
  image: 'data-[active=true]:bg-sky-600  data-[active=true]:text-white data-[active=true]:border-sky-600',
  video: 'data-[active=true]:bg-rose-600 data-[active=true]:text-white data-[active=true]:border-rose-600',
};

export function ModelPicker({
  provider, capability, model,
  onProviderChange, onCapabilityChange, onModelChange, disabled,
}: ModelPickerProps) {
  const models = getModels(provider, capability);
  const selectedModel = models.find((m) => m.id === model);

  function handleCapabilityChange(c: TestCapability) {
    onCapabilityChange(c);
    onModelChange(getDefaultModel(provider, c));
  }

  function handleProviderChange(p: TestProvider) {
    onProviderChange(p);
    onModelChange(getDefaultModel(p, capability));
  }

  return (
    <div className="space-y-5">
      {/* Capability */}
      <div className="space-y-2">
        <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Capability
        </Label>
        <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-muted">
          {CAPABILITIES.map((cap) => (
            <button
              key={cap.id}
              disabled={disabled}
              data-active={capability === cap.id}
              onClick={() => handleCapabilityChange(cap.id)}
              className={cn(
                'flex items-center justify-center gap-1.5 py-2 px-2 rounded-md text-xs font-medium',
                'border border-transparent transition-all duration-150',
                'text-muted-foreground hover:text-foreground',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                CAP_STYLES[cap.id],
              )}
            >
              <span className="text-sm leading-none">{cap.icon}</span>
              {cap.label}
            </button>
          ))}
        </div>
      </div>

      {/* Provider */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Provider
        </Label>
        <Select value={provider} onValueChange={(v) => handleProviderChange(v as TestProvider)} disabled={disabled}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROVIDERS.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Model */}
      <div className="space-y-1.5">
        <Label className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
          Model <span className="normal-case tracking-normal font-normal opacity-60">({models.length} available)</span>
        </Label>
        <Select value={model} onValueChange={onModelChange} disabled={disabled || models.length === 0}>
          <SelectTrigger className="h-9 text-sm">
            <SelectValue placeholder="Select a model…" />
          </SelectTrigger>
          <SelectContent>
            {models.map((m: ModelOption) => (
              <SelectItem key={m.id} value={m.id}>
                <div className="flex flex-col gap-0.5 py-0.5">
                  <span className="font-medium text-sm">{m.label}</span>
                  <span className="text-[11px] text-muted-foreground">{m.vendor}</span>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Selected model info card */}
      {selectedModel && (
        <div className="rounded-lg border bg-card p-3 space-y-2">
          <p className="text-[11px] font-mono text-muted-foreground truncate"
             title={selectedModel.id}>{selectedModel.id}</p>
          <p className="text-xs text-foreground/80 leading-relaxed">{selectedModel.description}</p>
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="text-[10px] px-1.5">{selectedModel.vendor}</Badge>
            <span className="text-[10px] text-muted-foreground">{selectedModel.pricing}</span>
          </div>
        </div>
      )}
    </div>
  );
}
