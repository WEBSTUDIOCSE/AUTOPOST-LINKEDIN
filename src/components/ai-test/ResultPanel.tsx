'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import type { TestResult } from './types';

interface ResultPanelProps {
  result: TestResult;
  onClear: () => void;
}

export function ResultPanel({ result, onClear }: ResultPanelProps) {
  if (result.status === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center h-72 gap-3 select-none">
        <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
          <span className="text-2xl opacity-40">◎</span>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium text-muted-foreground">No result yet</p>
          <p className="text-xs text-muted-foreground/60 mt-0.5">
            Configure a model and hit Generate
          </p>
        </div>
      </div>
    );
  }

  if (result.status === 'loading') {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
          <span className="h-3.5 w-3.5 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
          <span>Generating — this may take a moment for image or video…</span>
        </div>
        <div className="space-y-2 pt-2">
          <Skeleton className="h-3.5 w-full" />
          <Skeleton className="h-3.5 w-5/6" />
          <Skeleton className="h-3.5 w-4/6" />
          <Skeleton className="h-3.5 w-3/6" />
        </div>
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Meta bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <StatusBadge status={result.status} />
          {result.provider && (
            <Badge variant="outline" className="text-[10px] h-5">{result.provider}</Badge>
          )}
          {result.durationMs && (
            <span className="text-[11px] text-muted-foreground">
              {(result.durationMs / 1000).toFixed(2)}s
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onClear} className="h-6 text-xs px-2">
          ✕ Clear
        </Button>
      </div>

      {result.model && (
        <p className="text-[11px] font-mono text-muted-foreground truncate"
           title={result.model}>{result.model}</p>
      )}

      <Separator />

      {/* Error */}
      {result.status === 'error' && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div className="flex items-start gap-3">
            <span className="text-lg mt-0.5">⚠</span>
            <div className="space-y-1 flex-1 min-w-0">
              {result.errorCode && (
                <p className="text-xs font-mono font-semibold text-destructive">{result.errorCode}</p>
              )}
              <p className="text-sm text-muted-foreground break-words">{result.error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Text result */}
      {result.status === 'success' && result.text !== undefined && (
        <div className="space-y-2">
          <div className="rounded-lg border bg-muted/20 p-4 max-h-96 overflow-y-auto">
            <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{result.text}</pre>
          </div>
          <div className="flex items-center justify-between">
            <CopyButton text={result.text} />
            {result.usage && (
              <div className="flex gap-3 text-[10px] text-muted-foreground">
                {result.usage.promptTokens !== undefined && (
                  <span>↑ {result.usage.promptTokens.toLocaleString()} in</span>
                )}
                {result.usage.completionTokens !== undefined && (
                  <span>↓ {result.usage.completionTokens.toLocaleString()} out</span>
                )}
                {result.usage.totalTokens !== undefined && (
                  <span className="font-medium">{result.usage.totalTokens.toLocaleString()} total</span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Image results */}
      {result.status === 'success' && result.images && result.images.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {result.images.length} image{result.images.length > 1 ? 's' : ''} generated
          </p>
          <div className="grid gap-3">
            {result.images.map((img, i) => {
              const src = img.url ?? (img.base64 ? `data:${img.mimeType};base64,${img.base64}` : null);
              if (!src) return null;
              return (
                <div key={i} className="relative group rounded-lg overflow-hidden border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`Generated image ${i + 1}`}
                    className="w-full object-contain max-h-[480px] bg-muted/30"
                  />
                  <a
                    href={src}
                    target="_blank"
                    rel="noreferrer"
                    className={cn(
                      'absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity',
                      'bg-background/90 text-xs px-2.5 py-1.5 rounded-md border shadow-sm font-medium',
                    )}
                  >
                    Open ↗
                  </a>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Video results */}
      {result.status === 'success' && result.videos && result.videos.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            {result.videos.length} video{result.videos.length > 1 ? 's' : ''} generated
          </p>
          {result.videos.map((vid, i) => (
            <div key={i} className="rounded-lg overflow-hidden border">
              <video src={vid.url} controls className="w-full max-h-[480px]" preload="metadata" />
              <div className="px-3 py-2 flex items-center justify-between bg-muted/30 gap-2">
                <span className="text-[10px] text-muted-foreground font-mono truncate flex-1">{vid.url}</span>
                <a
                  href={vid.url}
                  download
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary hover:underline shrink-0 font-medium"
                >
                  Download ↗
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: TestResult['status'] }) {
  const map: Record<NonNullable<TestResult['status']>, { label: string; class: string }> = {
    idle:    { label: 'idle',    class: 'bg-muted text-muted-foreground' },
    loading: { label: 'running', class: 'bg-amber-500/15 text-amber-600 border-amber-300/50' },
    success: { label: 'success', class: 'bg-emerald-500/15 text-emerald-600 border-emerald-300/50' },
    error:   { label: 'error',   class: 'bg-destructive/15 text-destructive border-destructive/30' },
  };
  const s = map[status];
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border', s.class)}>
      {status === 'loading' && (
        <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
      )}
      {s.label}
    </span>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handleCopy() {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="h-7 text-xs gap-1.5">
      {copied ? '✓ Copied' : 'Copy'}
    </Button>
  );
}
