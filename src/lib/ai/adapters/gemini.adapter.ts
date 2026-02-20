/**
 * AI Adapter - Gemini Implementation
 * 
 * Uses the official @google/genai SDK (v1.42+).
 * 
 * Text:  Gemini 2.5 Flash / 2.5 Pro / 3 Flash / 3.1 Pro
 * Image: Nano Banana (gemini-2.5-flash-image, gemini-3-pro-image-preview via generateContent)
 *        Imagen 4 (imagen-4.0-* via generateImages)
 * Video: Veo 3.1 (veo-3.1-generate-preview via generateVideos → async poll)
 * 
 * Docs: https://ai.google.dev/gemini-api/docs
 */

import { GoogleGenAI, PersonGeneration } from '@google/genai';
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
  image: 'gemini-2.5-flash-image',      // Nano Banana (native image gen)
  video: 'veo-3.1-generate-preview',    // Veo 3.1 (with audio)
} as const;

/** Imagen models use a separate `generateImages` API path */
function isImagenModel(model: string): boolean {
  return model.startsWith('imagen-');
}

/** Nano Banana models use `generateContent` with responseModalities */
function isNanoBananaModel(model: string): boolean {
  return !isImagenModel(model);
}

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
    this.pollingInterval = config.pollingInterval ?? 10000;
    this.maxPollingAttempts = config.maxPollingAttempts ?? 60;

    const rlConfig: RateLimiterConfig = config.rateLimit ?? DEFAULT_RATE_LIMITS.gemini;
    this.rateLimiter = new RateLimiter(rlConfig);
  }

  /** Check rate limiter status without consuming a slot. */
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
  // Models: gemini-2.5-flash, gemini-2.5-pro, gemini-3-flash-preview,
  //         gemini-3.1-pro-preview

  async generateText(request: TextGenerationRequest): Promise<TextGenerationResponse> {
    if (!this.supportsCapability('text')) {
      throw new CapabilityNotSupportedError('gemini', 'text');
    }

    try {
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
  // Two paths:
  //   1) Nano Banana (gemini-2.5-flash-image, gemini-3-pro-image-preview)
  //      → generateContent with responseModalities: ['Image', 'Text']
  //      → Supports imageConfig { aspectRatio, imageSize, personGeneration }
  //   2) Imagen (imagen-4.0-generate-001, imagen-4.0-ultra-*, imagen-4.0-fast-*)
  //      → generateImages (standalone image generation pipeline)
  //      → Supports numberOfImages, aspectRatio, negativePrompt, imageSize, etc.

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    if (!this.supportsCapability('image')) {
      throw new CapabilityNotSupportedError('gemini', 'image');
    }

    try {
      await this.rateLimiter.acquire('gemini');

      const model = this.models.image;

      if (isImagenModel(model)) {
        return await this.generateImageWithImagen(model, request);
      }
      return await this.generateImageWithNanoBanana(model, request);
    } catch (error) {
      throw this.wrapError(error, 'IMAGE_GENERATION_FAILED');
    }
  }

  /**
   * Nano Banana path — uses generateContent with responseModalities: ['Image']
   * Models: gemini-2.5-flash-image, gemini-3-pro-image-preview
   */
  private async generateImageWithNanoBanana(
    model: string,
    request: ImageGenerationRequest,
  ): Promise<ImageGenerationResponse> {
    // Build imageConfig for aspect ratio, size, and person generation
    const hasImageConfig = request.aspectRatio || request.imageSize || request.personGeneration;
    const imageConfig = hasImageConfig
      ? {
          ...(request.aspectRatio && { aspectRatio: request.aspectRatio }),
          ...(request.imageSize && { imageSize: request.imageSize }),
          ...(request.personGeneration && { personGeneration: request.personGeneration }),
        }
      : undefined;

    const response = await this.client.models.generateContent({
      model,
      contents: request.prompt,
      config: {
        responseModalities: ['Image', 'Text'],
        ...(imageConfig && { imageConfig }),
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

    // If no images, surface a meaningful error
    if (images.length === 0) {
      const finishReason = response.candidates?.[0]?.finishReason ?? 'UNKNOWN';
      const reasonMessages: Record<string, string> = {
        RECITATION:
          'Image generation blocked (content policy / recitation). Try rephrasing your prompt as a visual description rather than a written task.',
        SAFETY: 'Image generation blocked by safety filters. Try a different prompt.',
        MAX_TOKENS: 'Response was cut off. Try a shorter prompt.',
      };
      const msg =
        reasonMessages[finishReason] ??
        `No images returned (finishReason: ${finishReason}). Try a more descriptive visual prompt.`;
      throw new AIAdapterError(msg, 'gemini', 'IMAGE_GENERATION_FAILED');
    }

    return { images, model, provider: 'gemini' };
  }

  /**
   * Imagen path — uses the dedicated generateImages API
   * Models: imagen-4.0-generate-001, imagen-4.0-ultra-generate-001,
   *         imagen-4.0-fast-generate-001
   */
  private async generateImageWithImagen(
    model: string,
    request: ImageGenerationRequest,
  ): Promise<ImageGenerationResponse> {
    const response = await this.client.models.generateImages({
      model,
      prompt: request.prompt,
      config: {
        ...(request.numberOfImages && { numberOfImages: request.numberOfImages }),
        ...(request.aspectRatio && { aspectRatio: request.aspectRatio }),
        ...(request.negativePrompt && { negativePrompt: request.negativePrompt }),
        ...(request.imageSize && { imageSize: request.imageSize }),
        ...(request.personGeneration && {
          personGeneration: request.personGeneration as PersonGeneration,
        }),
      },
    });

    const images: ImageGenerationResponse['images'] = [];

    if (response.generatedImages) {
      for (const genImg of response.generatedImages) {
        // Imagen returns images as base64 data in image.imageBytes
        const imgData = genImg.image;
        if (imgData) {
          // The SDK GeneratedImage has .image which is an Image_2 with imageBytes
          const bytes = (imgData as Record<string, unknown>).imageBytes as string | undefined;
          if (bytes) {
            images.push({
              base64: bytes,
              mimeType: 'image/png',
            });
          }
        }
      }
    }

    if (images.length === 0) {
      throw new AIAdapterError(
        'No images returned from Imagen. The prompt may have been blocked by safety filters.',
        'gemini',
        'IMAGE_GENERATION_FAILED',
      );
    }

    return { images, model, provider: 'gemini' };
  }

  // ── Video Generation ─────────────────────────────────────────────────────
  // Models: veo-3.1-generate-preview, veo-3.1-fast-generate-preview,
  //         veo-2.0-generate-001
  //
  // Veo 3.1 features:
  //   - Native audio generation (always on for 3.1)
  //   - Resolution: 720p (default), 1080p, 4k
  //   - Aspect ratio: 16:9 (default), 9:16
  //   - Duration: 4, 6, 8 seconds
  //   - Person generation: allow_all (text-to-video), allow_adult (image-to-video)
  //   - Reference images, first/last frame, video extension (via config)

  async generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    if (!this.supportsCapability('video')) {
      throw new CapabilityNotSupportedError('gemini', 'video');
    }

    try {
      await this.rateLimiter.acquire('gemini');

      const model = this.models.video;
      const isImageToVideo = !!request.imageUrl;

      // Build the video generation config
      const videoConfig = {
        ...(request.aspectRatio && { aspectRatio: request.aspectRatio }),
        ...(request.negativePrompt && { negativePrompt: request.negativePrompt }),
        ...(request.durationSeconds && { durationSeconds: request.durationSeconds }),
        ...(request.resolution && { resolution: request.resolution }),
        ...(request.numberOfVideos && { numberOfVideos: request.numberOfVideos }),
        // Person generation rules (Veo 3.1):
        //   text-to-video: allow_all
        //   image-to-video: allow_adult
        personGeneration: request.personGeneration
          ?? (isImageToVideo ? 'allow_adult' : 'allow_all'),
      } satisfies Record<string, unknown>;

      // If a starting image is provided, include it (must be a GCS URI gs://)
      const imageParam = request.imageUrl?.startsWith('gs://')
        ? { gcsUri: request.imageUrl }
        : undefined;

      let operation = await this.client.models.generateVideos({
        model,
        prompt: request.prompt,
        ...(imageParam && { image: imageParam }),
        config: videoConfig,
      });

      // Poll for completion
      for (let attempt = 0; attempt < this.maxPollingAttempts; attempt++) {
        if (operation.done) break;
        await this.sleep(this.pollingInterval);

        operation = await this.client.operations.getVideosOperation({
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

      if (videos.length === 0) {
        throw new AIAdapterError(
          'No videos returned. The prompt may have been blocked by safety filters, or generation failed silently. Try a more descriptive visual prompt.',
          'gemini',
          'VIDEO_GENERATION_FAILED',
        );
      }

      return { videos, model, provider: 'gemini' };
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
