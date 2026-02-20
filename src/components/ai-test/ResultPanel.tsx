'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { TestResult } from './types';

interface ResultPanelProps {
  result: TestResult;
  onClear: () => void;
}

export function ResultPanel({ result, onClear }: ResultPanelProps) {
  if (result.status === 'idle') {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground text-sm gap-2">
        <span className="text-3xl opacity-30">◎</span>
        <p>Run a generation to see results here</p>
      </div>
    );
  }

  if (result.status === 'loading') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="h-3 w-3 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          Generating — this may take a moment…
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
        <Skeleton className="h-32 w-full mt-4" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Meta row */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant={result.status === 'error' ? 'destructive' : 'default'}>
            {result.status}
          </Badge>
          {result.provider && (
            <Badge variant="outline" className="text-xs">{result.provider}</Badge>
          )}
          {result.model && (
            <Badge variant="outline" className="text-xs font-mono">{result.model}</Badge>
          )}
          {result.durationMs && (
            <span className="text-xs text-muted-foreground">
              {(result.durationMs / 1000).toFixed(1)}s
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onClear} className="h-7 text-xs">
          Clear
        </Button>
      </div>

      {/* Error */}
      {result.status === 'error' && (
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3">
          <p className="text-sm font-medium text-destructive mb-1">Error — {result.errorCode ?? 'UNKNOWN'}</p>
          <p className="text-sm text-muted-foreground">{result.error}</p>
        </div>
      )}

      {/* Text result */}
      {result.status === 'success' && result.text !== undefined && (
        <div className="space-y-2">
          <div className="rounded-md border bg-muted/30 p-4">
            <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">{result.text}</pre>
          </div>
          {result.usage && (
            <div className="flex gap-3 text-xs text-muted-foreground">
              {result.usage.promptTokens !== undefined && (
                <span>↑ {result.usage.promptTokens.toLocaleString()} tokens</span>
              )}
              {result.usage.completionTokens !== undefined && (
                <span>↓ {result.usage.completionTokens.toLocaleString()} tokens</span>
              )}
              {result.usage.totalTokens !== undefined && (
                <span>Total: {result.usage.totalTokens.toLocaleString()}</span>
              )}
            </div>
          )}
          <CopyButton text={result.text} />
        </div>
      )}

      {/* Image results */}
      {result.status === 'success' && result.images && result.images.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{result.images.length} image(s) generated</p>
          <div className="grid grid-cols-1 gap-3">
            {result.images.map((img, i) => {
              const src = img.url ?? (img.base64 ? `data:${img.mimeType};base64,${img.base64}` : null);
              if (!src) return null;
              return (
                <div key={i} className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`Generated image ${i + 1}`}
                    className="w-full rounded-md border object-contain max-h-96"
                  />
                  <a
                    href={src}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity
                      bg-background/80 text-xs px-2 py-1 rounded border"
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
          <p className="text-xs text-muted-foreground">{result.videos.length} video(s) generated</p>
          {result.videos.map((vid, i) => (
            <div key={i} className="rounded-md overflow-hidden border">
              <video
                src={vid.url}
                controls
                className="w-full max-h-96"
                preload="metadata"
              />
              <div className="p-2 flex items-center justify-between bg-muted/30">
                <span className="text-xs text-muted-foreground font-mono truncate">{vid.url}</span>
                <a
                  href={vid.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-primary hover:underline ml-2 shrink-0"
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

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="h-7 text-xs">
      {copied ? '✓ Copied' : 'Copy text'}
    </Button>
  );
}


