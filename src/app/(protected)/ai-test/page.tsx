import type { Metadata } from 'next';
import { AITestClient } from '@/components/ai-test/AITestClient';

export const metadata: Metadata = {
  title: 'AI Model Tester',
  description: 'Test and verify AI models — text, image, and video generation',
};

export default function AITestPage() {
  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">AI Model Tester</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Select a provider and model, then run a test to verify it is working correctly.
          </p>
        </div>
        <AITestClient />
      </div>
    </main>
  );
}
