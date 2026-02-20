/**
 * AI Test Panel — Client-Side Model Catalog
 *
 * Safe to import in client components — no server-only code.
 * Mirrors the server-side kieai-models.ts but includes Gemini models too.
 */

import type { ModelOption, TestCapability, TestProvider } from './types';

// ─── Gemini Models ─────────────────────────────────────────────────────────

const GEMINI_TEXT: ModelOption[] = [
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    vendor: 'Google',
    pricing: 'Free tier: 15 RPM',
    description: 'Fast, stable Gemini 2.5 Flash — confirmed working',
  },
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    vendor: 'Google',
    pricing: '$1.25/1M input, $10/1M output',
    description: 'Most capable Gemini 2.5 model for complex reasoning',
  },
];

const GEMINI_IMAGE: ModelOption[] = [
  {
    id: 'gemini-2.0-flash-exp-image-generation',
    label: 'Gemini 2.0 Flash (Image Gen)',
    vendor: 'Google',
    pricing: 'Free tier: 10 RPM',
    description: 'Native image generation via generateContent with responseModalities: [Image]',
  },
];

const GEMINI_VIDEO: ModelOption[] = [
  {
    id: 'veo-2.0-generate-001',
    label: 'Veo 2.0',
    vendor: 'Google',
    pricing: '$0.35/video-second (approx)',
    description: 'Google Veo 2 — high-quality text/image-to-video generation',
  },
  {
    id: 'veo-3.0-generate-preview',
    label: 'Veo 3.0 Preview',
    vendor: 'Google',
    pricing: '$0.50/video-second (approx)',
    description: 'Latest Veo 3 preview with audio generation',
  },
];

// ─── Kie.AI Models ─────────────────────────────────────────────────────────

const KIEAI_TEXT: ModelOption[] = [
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash (via Kie)',
    vendor: 'Google',
    pricing: '15 input / 60 output credits per 1M tokens',
    description: 'Fast Gemini 2.5 Flash proxied through Kie.AI',
  },
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro (via Kie)',
    vendor: 'Google',
    pricing: '50 input / 200 output credits per 1M tokens',
    description: 'Powerful Gemini 2.5 Pro via Kie.AI',
  },
  {
    id: 'gemini-3-flash',
    label: 'Gemini 3 Flash (via Kie)',
    vendor: 'Google',
    pricing: '30 input / 180 output credits per 1M tokens',
    description: 'Next-gen Gemini 3 Flash via Kie.AI',
  },
  {
    id: 'gemini-3-pro',
    label: 'Gemini 3 Pro (via Kie)',
    vendor: 'Google',
    pricing: '100 input / 700 output credits per 1M tokens',
    description: 'Next-gen Gemini 3 Pro via Kie.AI',
  },
  {
    id: 'claude/claude-opus-4-5',
    label: 'Claude Opus 4.5 (via Kie)',
    vendor: 'Anthropic',
    pricing: '~300 / 1500 credits per 1M tokens',
    description: 'Anthropic Claude Opus 4.5 via Kie.AI proxy',
  },
];

const KIEAI_IMAGE: ModelOption[] = [
  {
    id: 'flux-2/pro-text-to-image',
    label: 'Flux 2 Pro — Text to Image',
    vendor: 'Flux-2',
    pricing: '~5 credits (~$0.025)',
    description: 'High-quality text-to-image with strong prompt adherence',
  },
  {
    id: 'flux-2/pro-image-to-image',
    label: 'Flux 2 Pro — Image to Image',
    vendor: 'Flux-2',
    pricing: '~5 credits (~$0.025)',
    description: 'Transform an existing image guided by text',
  },
  {
    id: 'flux-2/flex-text-to-image',
    label: 'Flux 2 Flex — Text to Image',
    vendor: 'Flux-2',
    pricing: '~3 credits (~$0.015)',
    description: 'Flexible text-to-image with aspect ratio control',
  },
  {
    id: 'bytedance/seedream-v4-text-to-image',
    label: 'Seedream v4 — Text to Image',
    vendor: 'ByteDance',
    pricing: '~5 credits (~$0.025)',
    description: 'Latest Seedream v4 with enhanced detail and typography',
  },
  {
    id: 'bytedance/seedream-v4-edit',
    label: 'Seedream v4 — Edit',
    vendor: 'ByteDance',
    pricing: '~5 credits (~$0.025)',
    description: 'Image editing powered by Seedream v4',
  },
  {
    id: 'google/imagen4',
    label: 'Google Imagen 4',
    vendor: 'Google',
    pricing: '~5 credits (~$0.025)',
    description: 'Google Imagen 4 photorealistic image generation',
  },
  {
    id: 'google/imagen4-ultra',
    label: 'Google Imagen 4 Ultra',
    vendor: 'Google',
    pricing: '~10 credits (~$0.05)',
    description: 'Highest-quality Imagen 4 Ultra variant',
  },
  {
    id: 'grok-imagine/text-to-image',
    label: 'Grok Imagine — Text to Image',
    vendor: 'xAI',
    pricing: '~5 credits (~$0.025)',
    description: 'xAI Grok Imagine text-to-image',
  },
  {
    id: 'ideogram/v3-text-to-image',
    label: 'Ideogram v3 — Text to Image',
    vendor: 'Ideogram',
    pricing: '~5 credits (~$0.025)',
    description: 'Excellent text rendering inside images',
  },
  {
    id: 'qwen/text-to-image',
    label: 'Qwen — Text to Image',
    vendor: 'Alibaba',
    pricing: '~4 credits (~$0.02)',
    description: 'Alibaba Qwen text-to-image model',
  },
  {
    id: 'recraft/crisp-upscale',
    label: 'Recraft — Crisp Upscale',
    vendor: 'Recraft',
    pricing: '~2 credits (~$0.01)',
    description: 'AI-powered crisp image upscaling',
  },
  {
    id: 'recraft/remove-background',
    label: 'Recraft — Remove Background',
    vendor: 'Recraft',
    pricing: '1 credit (~$0.005)',
    description: 'AI background removal',
  },
];

const KIEAI_VIDEO: ModelOption[] = [
  {
    id: 'kling/v2-1-pro',
    label: 'Kling v2.1 Pro',
    vendor: 'Kuaishou',
    pricing: '55–110 credits, 5–10s',
    description: 'High-quality text or image-to-video',
  },
  {
    id: 'kling/v2-1-standard',
    label: 'Kling v2.1 Standard',
    vendor: 'Kuaishou',
    pricing: '35–70 credits, 5–10s',
    description: 'Standard quality video at lower cost',
  },
  {
    id: 'kling/v3-0-text-to-video',
    label: 'Kling 3.0 — Text to Video',
    vendor: 'Kuaishou',
    pricing: '20–40 credits/sec',
    description: 'Kling 3.0 with enhanced motion and detail',
  },
  {
    id: 'sora-2-pro-text-to-video',
    label: 'Sora 2 Pro — Text to Video',
    vendor: 'OpenAI',
    pricing: '35–40 credits/video',
    description: 'OpenAI Sora 2 pro-quality text-to-video',
  },
  {
    id: 'sora-2-pro-image-to-video',
    label: 'Sora 2 Pro — Image to Video',
    vendor: 'OpenAI',
    pricing: '35–40 credits/video',
    description: 'Animate a still image into video with Sora 2',
  },
  {
    id: 'bytedance/v1-pro-text-to-video',
    label: 'Seaweed Pro — Text to Video',
    vendor: 'ByteDance',
    pricing: '~40 credits/video',
    description: 'ByteDance Seaweed v1 Pro text-to-video',
  },
  {
    id: 'hailuo/2-3-image-to-video-pro',
    label: 'Hailuo 2.3 Pro — Image to Video',
    vendor: 'MiniMax',
    pricing: '~30 credits/video',
    description: 'MiniMax Hailuo 2.3 pro image-to-video',
  },
  {
    id: 'wan/2-6-text-to-video',
    label: 'Wan 2.6 — Text to Video',
    vendor: 'Alibaba',
    pricing: '104.5–315 credits/video',
    description: 'Latest Wan 2.6 text-to-video with enhanced quality',
  },
  {
    id: 'wan/2-6-image-to-video',
    label: 'Wan 2.6 — Image to Video',
    vendor: 'Alibaba',
    pricing: '104.5–315 credits/video',
    description: 'Wan 2.6 image-to-video',
  },
  {
    id: 'grok-imagine/text-to-video',
    label: 'Grok Imagine — Text to Video',
    vendor: 'xAI',
    pricing: '~30 credits/video',
    description: 'xAI Grok Imagine text-to-video generation',
  },
];

// ─── Catalog Map ────────────────────────────────────────────────────────────

export const MODEL_CATALOG: Record<TestProvider, Record<TestCapability, ModelOption[]>> = {
  gemini: {
    text: GEMINI_TEXT,
    image: GEMINI_IMAGE,
    video: GEMINI_VIDEO,
  },
  kieai: {
    text: KIEAI_TEXT,
    image: KIEAI_IMAGE,
    video: KIEAI_VIDEO,
  },
};

export function getModels(provider: TestProvider, capability: TestCapability): ModelOption[] {
  return MODEL_CATALOG[provider]?.[capability] ?? [];
}

export function getDefaultModel(provider: TestProvider, capability: TestCapability): string {
  return getModels(provider, capability)[0]?.id ?? '';
}

export const ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9'];

export const PROVIDERS: Array<{ id: TestProvider; label: string }> = [
  { id: 'gemini', label: 'Google Gemini (Direct)' },
  { id: 'kieai', label: 'Kie.AI (Multi-model)' },
];

export const CAPABILITIES: Array<{ id: TestCapability; label: string; icon: string }> = [
  { id: 'text', label: 'Text', icon: '✦' },
  { id: 'image', label: 'Image', icon: '◉' },
  { id: 'video', label: 'Video', icon: '▶' },
];
