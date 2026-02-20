'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ModelPicker } from './ModelPicker';
import { PromptForm } from './PromptForm';
import { ResultPanel } from './ResultPanel';
import { getDefaultModel } from './catalog';
import type { TestCapability, TestProvider, TestFormValues, TestResult } from './types';

const DEFAULT_FORM: TestFormValues = {
  capability: 'text',
  provider: 'gemini',
  model: getDefaultModel('gemini', 'text'),
  prompt: '',
};

const IDLE_RESULT: TestResult = { status: 'idle' };

export function AITestClient() {
  const [form, setForm] = useState<TestFormValues>(DEFAULT_FORM);
  const [result, setResult] = useState<TestResult>(IDLE_RESULT);

  const patchForm = useCallback((patch: Partial<TestFormValues>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleCapabilityChange = useCallback((capability: TestCapability) => {
    patchForm({ capability });
  }, [patchForm]);

  const handleProviderChange = useCallback((provider: TestProvider) => {
    patchForm({ provider });
  }, [patchForm]);

  const handleModelChange = useCallback((model: string) => {
    patchForm({ model });
  }, [patchForm]);

  const handleSubmit = useCallback(async () => {
    if (!form.prompt.trim()) return;

    const start = Date.now();
    setResult({ status: 'loading' });

    try {
      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json() as Record<string, unknown>;
      const durationMs = Date.now() - start;

      if (!res.ok) {
        setResult({
          status: 'error',
          durationMs,
          provider: form.provider,
          model: form.model,
          error: (data?.error as string) ?? `HTTP ${res.status}`,
          errorCode: (data?.code as string) ?? undefined,
        });
        return;
      }

      // The API nests adapter output under `result`
      const inner = (data.result ?? data) as Record<string, unknown>;

      setResult({
        status: 'success',
        capability: form.capability,
        provider: form.provider,
        model: form.model,
        durationMs: typeof data.durationMs === 'number' ? data.durationMs : durationMs,
        text: typeof inner.text === 'string' ? inner.text : undefined,
        usage: inner.usage as TestResult['usage'],
        images: inner.images as TestResult['images'],
        videos: inner.videos as TestResult['videos'],
      });
    } catch (err) {
      setResult({
        status: 'error',
        durationMs: Date.now() - start,
        provider: form.provider,
        model: form.model,
        error: err instanceof Error ? err.message : 'Unexpected network error',
      });
    }
  }, [form]);

  const isLoading = result.status === 'loading';

  return (
    <div className="grid grid-cols-1 md:grid-cols-[320px,1fr] gap-4 md:gap-6 items-start">
      {/* Left column — configuration */}
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <ModelPicker
              provider={form.provider}
              capability={form.capability}
              model={form.model}
              onProviderChange={handleProviderChange}
              onCapabilityChange={handleCapabilityChange}
              onModelChange={handleModelChange}
              disabled={isLoading}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Prompt</CardTitle>
          </CardHeader>
          <CardContent>
            <PromptForm
              capability={form.capability}
              values={form}
              onChange={patchForm}
              onSubmit={() => void handleSubmit()}
              loading={isLoading}
            />
          </CardContent>
        </Card>
      </div>

      {/* Right column — result */}
      <Card className="min-h-[320px] md:min-h-[480px]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold">Output</CardTitle>
            {result.status !== 'idle' && (
              <span className="text-[11px] text-muted-foreground">
                {form.capability} · {form.provider}
              </span>
            )}
          </div>
          <Separator />
        </CardHeader>
        <CardContent>
          <ResultPanel result={result} onClear={() => setResult(IDLE_RESULT)} />
        </CardContent>
      </Card>
    </div>
  );
}
