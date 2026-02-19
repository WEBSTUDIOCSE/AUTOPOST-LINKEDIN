/**
 * AI Adapter - Shared Types
 * 
 * Provider-agnostic type definitions for the AI adapter layer.
 * All adapters implement these types so the app never couples to a specific provider.
 */

// ─── Provider Registry ───────────────────────────────────────────────────────

/** Supported AI providers */
export type AIProvider = 'gemini' | 'kieai';

/** Capabilities each provider may or may not support */
export type AICapability = 'text' | 'image' | 'video';

// ─── Text Generation ─────────────────────────────────────────────────────────

export interface TextGenerationRequest {
  /** The user prompt */
  prompt: string;
  /** Optional system instruction to guide model behavior */
  systemInstruction?: string;
  /** Creativity control (0-2, default 1.0) */
  temperature?: number;
  /** Maximum tokens in the response */
  maxTokens?: number;
}

export interface TextGenerationResponse {
  /** The generated text content */
  text: string;
  /** Provider-specific model name used */
  model: string;
  /** Provider that handled the request */
  provider: AIProvider;
  /** Token usage stats (if available) */
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

// ─── Image Generation ────────────────────────────────────────────────────────

export interface ImageGenerationRequest {
  /** Text prompt describing the image */
  prompt: string;
  /** Aspect ratio (e.g. '1:1', '16:9', '9:16') */
  aspectRatio?: string;
  /** Negative prompt - what to avoid */
  negativePrompt?: string;
  /** Number of images to generate (default 1) */
  numberOfImages?: number;
}

export interface ImageGenerationResponse {
  /** Array of generated image URLs or base64 data */
  images: GeneratedImage[];
  /** Provider-specific model name used */
  model: string;
  /** Provider that handled the request */
  provider: AIProvider;
}

export interface GeneratedImage {
  /** URL to the generated image (if hosted) */
  url?: string;
  /** Base64-encoded image data (if returned inline) */
  base64?: string;
  /** MIME type of the image */
  mimeType: string;
}

// ─── Video Generation ────────────────────────────────────────────────────────

export interface VideoGenerationRequest {
  /** Text prompt describing the video */
  prompt: string;
  /** Optional starting image URL or base64 */
  imageUrl?: string;
  /** Aspect ratio (e.g. '16:9', '9:16') */
  aspectRatio?: string;
  /** Duration in seconds */
  durationSeconds?: number;
  /** Negative prompt - what to avoid */
  negativePrompt?: string;
}

export interface VideoGenerationResponse {
  /** Array of generated video URLs */
  videos: GeneratedVideo[];
  /** Provider-specific model name used */
  model: string;
  /** Provider that handled the request */
  provider: AIProvider;
}

export interface GeneratedVideo {
  /** URL to the generated video */
  url: string;
  /** MIME type (typically 'video/mp4') */
  mimeType: string;
  /** Duration in seconds (if known) */
  durationSeconds?: number;
}

// ─── Async Task (used by kie.ai-style providers) ────────────────────────────

export type TaskState = 'waiting' | 'queuing' | 'generating' | 'success' | 'fail';

export interface TaskStatusResponse {
  taskId: string;
  state: TaskState;
  /** Parsed result URLs when state === 'success' */
  resultUrls?: string[];
  /** Error message when state === 'fail' */
  failMessage?: string;
  /** Raw result JSON string */
  resultJson?: string;
}

// ─── Provider Configuration ──────────────────────────────────────────────────

export interface AIProviderConfig {
  /** Which provider to use */
  provider: AIProvider;
  /** API key for the provider */
  apiKey: string;
  /** Optional: specific models to use per capability */
  models?: {
    text?: string;
    image?: string;
    video?: string;
  };
  /** Optional: polling interval in ms for async providers (default 5000) */
  pollingInterval?: number;
  /** Optional: max polling attempts for async providers (default 60) */
  maxPollingAttempts?: number;
}

// ─── Errors ──────────────────────────────────────────────────────────────────

export class AIAdapterError extends Error {
  constructor(
    message: string,
    public readonly provider: AIProvider,
    public readonly code: string,
    public readonly statusCode?: number,
  ) {
    super(`[${provider}] ${message}`);
    this.name = 'AIAdapterError';
  }
}

export class CapabilityNotSupportedError extends AIAdapterError {
  constructor(provider: AIProvider, capability: AICapability) {
    super(
      `Capability "${capability}" is not supported by provider "${provider}"`,
      provider,
      'CAPABILITY_NOT_SUPPORTED',
    );
    this.name = 'CapabilityNotSupportedError';
  }
}
