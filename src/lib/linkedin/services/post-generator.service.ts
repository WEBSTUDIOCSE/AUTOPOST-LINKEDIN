/**
 * AI Post Generation Service
 *
 * Uses the AI adapter layer + PromptService to generate LinkedIn post
 * drafts with optional image or video media.
 *
 * Supports user-controlled model selection: provider, per-capability model,
 * temperature, max tokens, and media config overrides.
 *
 * SERVER-ONLY — accesses API keys, must never be imported from client code.
 */

import { createAIAdapter } from '@/lib/ai';
import { getAIConfig } from '@/lib/firebase/config/environments';
import { AI_CONFIGS } from '@/lib/firebase/config/environments';
import { PromptService } from './prompt.service';
import type { PostGenerationContext, PostMediaType } from '../types';
import type { AIProviderConfig, AIProvider } from '@/lib/ai';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/** Media result from AI generation */
export interface GeneratedMedia {
  /** Public URL of the generated media */
  url: string;
  /** MIME type (e.g. 'image/png', 'video/mp4') */
  mimeType: string;
  /** The prompt used to generate this media */
  prompt: string;
}

export interface GeneratedPost {
  content: string;
  /** Short 1-line summary for feeding to the next post as context */
  summary: string;
  /** Generated media (image or video) — undefined for text-only posts */
  media?: GeneratedMedia;
  /** What type of media was generated */
  mediaType: PostMediaType;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Build an AIProviderConfig with user overrides applied.
 * Falls back to env defaults for anything not specified.
 */
function buildAdapterConfig(ctx: PostGenerationContext): AIProviderConfig {
  const provider: AIProvider = ctx.provider ?? getAIConfig().provider;
  const baseConfig = AI_CONFIGS[provider] ?? getAIConfig();

  return {
    ...baseConfig,
    provider,
    models: {
      text: ctx.textModel ?? baseConfig.models?.text,
      image: ctx.imageModel ?? baseConfig.models?.image,
      video: ctx.videoModel ?? baseConfig.models?.video,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// GENERATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate a LinkedIn post draft using the configured AI provider.
 * Handles text generation + optional image/video generation.
 *
 * @param context — topic, series info, continuity data, persona, mediaType,
 *                  and optional provider/model/temperature/media overrides.
 * @returns The generated post content + summary + optional media
 */
export async function generatePostDraft(context: PostGenerationContext): Promise<GeneratedPost> {
  const config = buildAdapterConfig(context);
  const adapter = createAIAdapter(config);
  const mediaType = context.mediaType ?? 'text';

  // Temperature: user override > PromptService default
  const temperature = context.temperature ?? PromptService.getTemperature(mediaType);
  const maxTokens = context.maxTokens ?? 1024;

  // 1. Generate the main post text
  const postResult = await adapter.generateText({
    prompt: PromptService.buildUserPrompt(context),
    systemInstruction: PromptService.buildSystemPrompt(mediaType, context.persona),
    temperature,
    maxTokens,
  });

  const content = postResult.text.trim();

  // 2. Generate a short summary (for continuity with the next post)
  const summaryResult = await adapter.generateText({
    prompt: PromptService.buildSummaryPrompt(content),
    systemInstruction: PromptService.getSummarySystem(),
    temperature: 0.3,
    maxTokens: 100,
  });

  const summary = summaryResult.text.trim();

  // 3. Generate media if requested
  let media: GeneratedMedia | undefined;

  if (mediaType === 'image' && adapter.supportsCapability('image')) {
    const imgPromptResult = await adapter.generateText({
      prompt: PromptService.buildMediaUserPrompt(context.topic, content),
      systemInstruction: PromptService.getMediaPromptInstruction('image'),
      temperature: 0.7,
      maxTokens: 200,
    });

    const imagePrompt = imgPromptResult.text.trim();
    const defaultCfg = PromptService.getImageConfig();

    const imageResult = await adapter.generateImage({
      prompt: imagePrompt,
      aspectRatio: context.aspectRatio ?? defaultCfg.aspectRatio,
      numberOfImages: context.numberOfImages ?? defaultCfg.numberOfImages,
      imageSize: context.imageSize,
      negativePrompt: context.negativePrompt,
    });

    if (imageResult.images.length > 0) {
      const img = imageResult.images[0];
      media = {
        url: img.url ?? (img.base64 ? `data:${img.mimeType};base64,${img.base64}` : ''),
        mimeType: img.mimeType,
        prompt: imagePrompt,
      };
    }
  } else if (mediaType === 'video' && adapter.supportsCapability('video')) {
    const vidPromptResult = await adapter.generateText({
      prompt: PromptService.buildMediaUserPrompt(context.topic, content),
      systemInstruction: PromptService.getMediaPromptInstruction('video'),
      temperature: 0.7,
      maxTokens: 200,
    });

    const videoPrompt = vidPromptResult.text.trim();
    const defaultCfg = PromptService.getVideoConfig();

    const videoResult = await adapter.generateVideo({
      prompt: videoPrompt,
      aspectRatio: context.aspectRatio ?? defaultCfg.aspectRatio,
      durationSeconds: context.durationSeconds ?? defaultCfg.durationSeconds,
      numberOfVideos: defaultCfg.numberOfVideos,
      resolution: context.videoResolution,
      negativePrompt: context.negativePrompt,
    });

    if (videoResult.videos.length > 0) {
      const vid = videoResult.videos[0];
      media = {
        url: vid.url,
        mimeType: vid.mimeType,
        prompt: videoPrompt,
      };
    }
  }

  return { content, summary, media, mediaType };
}

/**
 * Regenerate — same as generate but with a "try a different angle" hint.
 */
export async function regeneratePostDraft(
  context: PostGenerationContext,
  previousDraft: string,
): Promise<GeneratedPost> {
  return generatePostDraft(
    PromptService.buildRegenerationContext(context, previousDraft),
  );
}
