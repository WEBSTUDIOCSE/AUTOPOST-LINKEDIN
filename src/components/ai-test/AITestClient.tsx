'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { ModelPicker } from './ModelPicker';
import { PromptForm } from './PromptForm';
import { ResultPanel } from './ResultPanel';
import { getDefaultModel } from './catalog';
import type { TestCapability, TestProvider, TestFormValues, TestResult } from './types';

const INITIAL_FORM: TestFormValues = {
  capability: 'text',
  provider: 'kieai',
  model: getDefaultModel('kieai', 'text'),
  prompt: '',
};

const IDLE_RESULT: TestResult = { status: 'idle' };

export function AITestClient() {
  const [form, setForm] = useState<TestFormValues>(INITIAL_FORM);
  const [result, setResult] = useState<TestResult>(IDLE_RESULT);

  const patchForm = useCallback((patch: Partial<TestFormValues>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  async function handleRun() {
    if (!form.prompt.trim()) return;

    setResult({ status: 'loading' });

    try {
      const res = await fetch('/api/ai/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capability: form.capability,
          provider: form.provider,
          model: form.model,
          prompt: form.prompt,
          systemInstruction: form.systemInstruction,
          temperature: form.temperature,
          maxTokens: form.maxTokens,
          aspectRatio: form.aspectRatio,
          negativePrompt: form.negativePrompt,
          durationSeconds: form.durationSeconds,
          imageUrl: form.imageUrl,
        }),
      });

      const json = (await res.json()) as {
        status: string;
        provider?: string;
        capability?: string;
        durationMs?: number;
        result?: {
          text?: string;
          model?: string;
          usage?: TestResult['usage'];
          images?: TestResult['images'];
          videos?: TestResult['videos'];
        };
        error?: string;
        code?: string;
      };

      if (!res.ok || json.status === 'error') {
        setResult({
          status: 'error',
          error: json.error ?? 'Unknown error',
          errorCode: json.code,
        });
        return;
      }

      setResult({
        status: 'success',
        provider: json.provider,
        capability: json.capability as TestCapability,
        durationMs: json.durationMs,
        model: json.result?.model ?? form.model,
        text: json.result?.text,
        usage: json.result?.usage,
        images: json.result?.images,
        videos: json.result?.videos,
      });
    } catch {
      setResult({
        status: 'error',
        error: 'Network error — make sure the dev server is running.',
        errorCode: 'NETWORK_ERROR',
      });
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6 items-start">
      {/* Left Panel — Config */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Configuration</CardTitle>
          <CardDescription className="text-xs">
            Select a capability, provider, and model then enter your prompt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ModelPicker
            provider={form.provider as TestProvider}
            capability={form.capability as TestCapability}
            model={form.model}
            onProviderChange={(p) => patchForm({ provider: p })}
            onCapabilityChange={(c) => patchForm({ capability: c })}
            onModelChange={(m) => patchForm({ model: m })}
            disabled={result.status === 'loading'}
          />
          <Separator />
          <PromptForm
            capability={form.capability as TestCapability}
            values={form}
            onChange={patchForm}
            onSubmit={handleRun}
            loading={result.status === 'loading'}
          />
        </CardContent>
      </Card>

      {/* Right Panel — Result */}
      <Card className="min-h-[480px]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Result</CardTitle>
          <CardDescription className="text-xs">
            Output from the selected model will appear here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResultPanel
            result={result}
            onClear={() => setResult(IDLE_RESULT)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
