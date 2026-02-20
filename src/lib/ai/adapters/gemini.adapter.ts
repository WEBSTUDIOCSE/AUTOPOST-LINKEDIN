/**
 * AI Adapter - Gemini Implementation
 * 
 * Uses the official @google/genai SDK.
 * 
 * Text:  Gemini 2.5 Flash (generateContent)
 * Image: Gemini 2.5 Flash Image / Nano Banana (generateContent with responseModalities: ['Image'])
 * Video: Veo 3 (generateVideos → async poll via operation)
 * 
 * Docs: https://ai.google.dev/gemini-api/docs
 */

import { GoogleGenAI } from '@google/genai';
import type { IAIAdapter } from '../adapter.interface';
import type {
  AICapability,
  AIProviderConfig,
  TextGenerationRequest,
  TextGenerationResponse,
  ImageGenerationRequest,
  ImageGenerationResponse,
  VideoGenerationRequest,
  VideoGenerationResponse,
} from '../types';
import { AIAdapterError, CapabilityNotSupportedError } from '../types';
import { RateLimiter, DEFAULT_RATE_LIMITS } from '../rate-limiter';
import type { RateLimiterConfig, RateLimiterStatus } from '../rate-limiter';

// ─── Default models ──────────────────────────────────────────────────────────

const DEFAULT_MODELS = {
  text: 'gemini-2.5-flash',
  image: 'gemini-2.0-flash-exp-image-generation',
  video: 'veo-2.0-generate-001',
} as const;

// ─── Adapter ─────────────────────────────────────────────────────────────────

export class GeminiAdapter implements IAIAdapter {
  readonly name = 'Gemini';
  readonly provider = 'gemini' as const;

  private readonly client: GoogleGenAI;
  private readonly models: { text: string; image: string; video: string };
  private readonly pollingInterval: number;
  private readonly maxPollingAttempts: number;
  private readonly rateLimiter: RateLimiter;

  constructor(config: AIProviderConfig) {
    this.client = new GoogleGenAI({ apiKey: config.apiKey });
    this.models = {
      text: config.models?.text ?? DEFAULT_MODELS.text,
      image: config.models?.image ?? DEFAULT_MODELS.image,
      video: config.models?.video ?? DEFAULT_MODELS.video,
    };
    this.pollingInterval = config.pollingInterval ?? 10000; // Video gen is slow
    this.maxPollingAttempts = config.maxPollingAttempts ?? 60;

    // Initialize rate limiter from config or use provider defaults
    const rlConfig: RateLimiterConfig = config.rateLimit ?? DEFAULT_RATE_LIMITS.gemini;
    this.rateLimiter = new RateLimiter(rlConfig);
  }

  /**
   * Check rate limiter status without consuming a slot.
   */
  getRateLimitStatus(): RateLimiterStatus {
    return this.rateLimiter.getStatus();
  }

  // ── Capability discovery ─────────────────────────────────────────────────

  getSupportedCapabilities(): AICapability[] {
    return ['text', 'image', 'video'];
  }

  supportsCapability(capability: AICapability): boolean {
    return this.getSupportedCapabilities().includes(capability);
  }

  // ── Text Generation ──────────────────────────────────────────────────────

  async generateText(request: TextGenerationRequest): Promise<TextGenerationResponse> {
    if (!this.supportsCapability('text')) {
      throw new CapabilityNotSupportedError('gemini', 'text');
    }

    try {
      // Rate limit check
      await this.rateLimiter.acquire('gemini');

      const response = await this.client.models.generateContent({
        model: this.models.text,
        contents: request.prompt,
        config: {
          ...(request.systemInstruction && {
            systemInstruction: request.systemInstruction,
          }),
          ...(request.temperature !== undefined && {
            temperature: request.temperature,
          }),
          ...(request.maxTokens !== undefined && {
            maxOutputTokens: request.maxTokens,
          }),
        },
      });

      const text = response.text ?? '';

      return {
        text,
        model: this.models.text,
        provider: 'gemini',
        usage: response.usageMetadata
          ? {
              promptTokens: response.usageMetadata.promptTokenCount,
              completionTokens: response.usageMetadata.candidatesTokenCount,
              totalTokens: response.usageMetadata.totalTokenCount,
            }
          : undefined,
      };
    } catch (error) {
      throw this.wrapError(error, 'TEXT_GENERATION_FAILED');
    }
  }

  // ── Image Generation ─────────────────────────────────────────────────────

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    if (!this.supportsCapability('image')) {
      throw new CapabilityNotSupportedError('gemini', 'image');
    }

    try {
      // Rate limit check
      await this.rateLimiter.acquire('gemini');

      // Gemini Nano Banana: use generateContent with responseModalities: ['Image']
      const response = await this.client.models.generateContent({
        model: this.models.image,
        contents: request.prompt,
        config: {
          responseModalities: ['Image', 'Text'],
          ...(request.numberOfImages !== undefined && {
            candidateCount: request.numberOfImages,
          }),
        },
      });

      const images: ImageGenerationResponse['images'] = [];

      // Extract inline images from response parts
      if (response.candidates) {
        for (const candidate of response.candidates) {
          if (candidate.content?.parts) {
            for (const part of candidate.content.parts) {
              if (part.inlineData) {
                images.push({
                  base64: part.inlineData.data,
                  mimeType: part.inlineData.mimeType ?? 'image/png',
                });
              }
            }
          }
        }
      }

      // If no images were extracted, surface a meaningful error instead of silent empty result
      if (images.length === 0) {
        const finishReason = response.candidates?.[0]?.finishReason ?? 'UNKNOWN';
        const reasonMessages: Record<string, string> = {
          RECITATION: 'Image generation blocked (content policy / recitation). Try rephrasing your prompt as a visual description rather than a written task.',
          SAFETY: 'Image generation blocked by safety filters. Try a different prompt.',
          MAX_TOKENS: 'Response was cut off. Try a shorter prompt.',
        };
        const msg = reasonMessages[finishReason] ?? `No images returned (finishReason: ${finishReason}). Try a more descriptive visual prompt.`;
        throw new AIAdapterError(msg, 'gemini', 'IMAGE_GENERATION_FAILED');
      }

      return {
        images,
        model: this.models.image,
        provider: 'gemini',
      };
    } catch (error) {
      throw this.wrapError(error, 'IMAGE_GENERATION_FAILED');
    }
  }

  // ── Video Generation ─────────────────────────────────────────────────────

  async generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    if (!this.supportsCapability('video')) {
      throw new CapabilityNotSupportedError('gemini', 'video');
    }

    try {
      // Rate limit check
      await this.rateLimiter.acquire('gemini');

      // Veo: async long-running operation
      // Build the generate request
      const generateConfig: Record<string, unknown> = {
        prompt: request.prompt,
        ...(request.aspectRatio && { aspectRatio: request.aspectRatio }),
        ...(request.negativePrompt && { negativePrompt: request.negativePrompt }),
        ...(request.durationSeconds && { durationSeconds: String(request.durationSeconds) }),
        personGeneration: 'allow_all',
      };

      // If a starting image is provided, include it
      if (request.imageUrl) {
        generateConfig.image = {
          imageUri: request.imageUrl,
        };
      }

      // Use the REST-style approach via the SDK's generateVideos
      let operation = await this.client.models.generateVideos({
        model: this.models.video,
        ...generateConfig,
      });

      // Poll for completion
      for (let attempt = 0; attempt < this.maxPollingAttempts; attempt++) {
        if (operation.done) break;
        await this.sleep(this.pollingInterval);

        operation = await this.client.operations.get({
          operation: operation,
        });
      }

      if (!operation.done) {
        throw new AIAdapterError(
          'Video generation timed out',
          'gemini',
          'VIDEO_TIMEOUT',
        );
      }

      const videos: VideoGenerationResponse['videos'] = [];

      // Extract generated videos from the response
      if (operation.response?.generatedVideos) {
        for (const genVideo of operation.response.generatedVideos) {
          if (genVideo.video?.uri) {
            videos.push({
              url: genVideo.video.uri,
              mimeType: 'video/mp4',
            });
          }
        }
      }

      return {
        videos,
        model: this.models.video,
        provider: 'gemini',
      };
    } catch (error) {
      if (error instanceof AIAdapterError) throw error;
      throw this.wrapError(error, 'VIDEO_GENERATION_FAILED');
    }
  }

  // ── Internals ────────────────────────────────────────────────────────────

  private wrapError(error: unknown, code: string): AIAdapterError {
    const message = error instanceof Error ? error.message : String(error);
    return new AIAdapterError(message, 'gemini', code);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
