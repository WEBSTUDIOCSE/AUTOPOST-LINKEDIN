/**
 * AI Adapter - Abstract Interface
 * 
 * Every AI provider adapter MUST implement this interface.
 * The rest of the application only ever imports this interface,
 * never the concrete adapters directly.
 */

import type {
  AICapability,
  AIProvider,
  TextGenerationRequest,
  TextGenerationResponse,
  ImageGenerationRequest,
  ImageGenerationResponse,
  VideoGenerationRequest,
  VideoGenerationResponse,
} from './types';

export interface IAIAdapter {
  /** Human label for this adapter (e.g. "Gemini", "KieAI") */
  readonly name: string;

  /** Provider key */
  readonly provider: AIProvider;

  /** Returns the set of capabilities this adapter supports at runtime */
  getSupportedCapabilities(): AICapability[];

  /** Check if a specific capability is supported */
  supportsCapability(capability: AICapability): boolean;

  // ── Text ─────────────────────────────────────────────────────────────────

  /** Generate text from a prompt */
  generateText(request: TextGenerationRequest): Promise<TextGenerationResponse>;

  // ── Image ────────────────────────────────────────────────────────────────

  /** Generate image(s) from a text prompt */
  generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse>;

  // ── Video ────────────────────────────────────────────────────────────────

  /** Generate video from a text prompt (and optional starting image) */
  generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResponse>;
}
