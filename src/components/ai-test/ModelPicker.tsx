'use client';

import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  PROVIDERS,
  CAPABILITIES,
  getModels,
  getDefaultModel,
} from './catalog';
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

export function ModelPicker({
  provider,
  capability,
  model,
  onProviderChange,
  onCapabilityChange,
  onModelChange,
  disabled,
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
    <div className="space-y-4">
      {/* Capability Tabs */}
      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-2 block">
          Capability
        </Label>
        <div className="flex gap-2">
          {CAPABILITIES.map((cap) => (
            <button
              key={cap.id}
              disabled={disabled}
              onClick={() => handleCapabilityChange(cap.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors
                ${capability === cap.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }
                disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <span className="text-xs">{cap.icon}</span>
              {cap.label}
            </button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Provider Select */}
      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5 block">
          Provider
        </Label>
        <Select
          value={provider}
          onValueChange={(v) => handleProviderChange(v as TestProvider)}
          disabled={disabled}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PROVIDERS.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Model Select */}
      <div>
        <Label className="text-xs uppercase tracking-wide text-muted-foreground mb-1.5 block">
          Model
        </Label>
        <Select
          value={model}
          onValueChange={onModelChange}
          disabled={disabled || models.length === 0}
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Select a model…" />
          </SelectTrigger>
          <SelectContent>
            {models.map((m: ModelOption) => (
              <SelectItem key={m.id} value={m.id}>
                <span className="flex flex-col">
                  <span className="font-medium">{m.label}</span>
                  <span className="text-xs text-muted-foreground">{m.vendor}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Selected model info */}
      {selectedModel && (
        <div className="rounded-md border bg-muted/40 p-3 space-y-1">
          <p className="text-xs text-muted-foreground">{selectedModel.description}</p>
          <Badge variant="secondary" className="text-xs font-normal">
            {selectedModel.pricing}
          </Badge>
        </div>
      )}
    </div>
  );
}
