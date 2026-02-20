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
  /** Aspect ratio (e.g. '1:1', '16:9', '9:16', '3:4', '4:3', '21:9') */
  aspectRatio?: string;
  /** Negative prompt - what to avoid */
  negativePrompt?: string;
  /** Number of images to generate (default 1) */
  numberOfImages?: number;
  /** Output image resolution: '1K', '2K', '4K' (Nano Banana Pro / Imagen) */
  imageSize?: string;
  /** Allow person generation: 'allow_all', 'allow_adult', 'dont_allow' */
  personGeneration?: string;
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
  /** Duration in seconds (Veo 3.1: 4, 6, 8) */
  durationSeconds?: number;
  /** Negative prompt - what to avoid */
  negativePrompt?: string;
  /** Output resolution: '720p', '1080p', '4k' (Veo 3.1) */
  resolution?: string;
  /** Allow person generation: 'allow_all', 'allow_adult', 'dont_allow' */
  personGeneration?: string;
  /** Number of videos to generate (default 1) */
  numberOfVideos?: number;
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
  /** Optional: rate limiter config to protect against API key abuse */
  rateLimit?: {
    /** Max requests allowed within the window */
    maxRequests: number;
    /** Window duration in milliseconds */
    windowMs: number;
    /** Wait for a slot instead of throwing (default: true) */
    waitForSlot?: boolean;
    /** Max time to wait for a slot in ms (default: 30000) */
    maxWaitMs?: number;
  };
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
