import { Metadata } from 'next';
import { AITestClient } from '@/components/ai-test/AITestClient';

export const metadata: Metadata = {
  title: 'AI Model Tester — LinkedIn Automation',
  description: 'Interactively test text, image, and video generation across AI providers.',
};

export default function AITestPage() {
  return (
    <div className="container mx-auto max-w-5xl py-8 space-y-6">
      {/* Page header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Protected</span>
          <span>›</span>
          <span>AI Model Tester</span>
        </div>
        <h1 className="text-2xl font-bold tracking-tight">AI Model Tester</h1>
        <p className="text-sm text-muted-foreground max-w-xl">
          Select a provider, pick a capability and model, then enter a prompt to verify
          that each model is working end-to-end.
        </p>
      </div>

      {/* Notice */}
      <div className="rounded-lg border px-4 py-2.5 text-xs bg-muted/50 text-muted-foreground">
        <strong>Heads up:</strong> Image and video generation may take 10–60 seconds.
        Costs real API credits — use sparingly.
      </div>

      {/* Main tester */}
      <AITestClient />
    </div>
  );
}
