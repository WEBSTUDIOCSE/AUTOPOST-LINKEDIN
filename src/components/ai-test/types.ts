/**
 * AI Test Panel — Shared Types
 */

export type TestCapability = 'text' | 'image' | 'video';
export type TestProvider = 'gemini' | 'kieai';
export type TestStatus = 'idle' | 'loading' | 'success' | 'error';

export interface ModelOption {
  id: string;
  label: string;
  vendor: string;
  pricing: string;
  description: string;
}

/** Options passed from the form to the API */
export interface TestFormValues {
  capability: TestCapability;
  provider: TestProvider;
  model: string;
  prompt: string;
  // text options
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  // image/video options
  aspectRatio?: string;
  negativePrompt?: string;
  // video only
  durationSeconds?: number;
  imageUrl?: string;
}

/** Result state after a test run */
export interface TestResult {
  status: TestStatus;
  capability?: TestCapability;
  provider?: string;
  model?: string;
  durationMs?: number;
  // text result
  text?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  // image result
  images?: Array<{
    url?: string;
    base64?: string;
    mimeType: string;
  }>;
  // video result
  videos?: Array<{
    url: string;
    mimeType: string;
  }>;
  // error
  error?: string;
  errorCode?: string;
}
