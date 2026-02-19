/**
 * Kie.AI — Complete Model Catalog
 *
 * Every model offered by Kie.AI for image, video, and chat generation.
 * Each entry includes the API model ID, human label, capability type,
 * vendor, and pricing info (in Kie.AI credits and approximate USD).
 *
 * 1 credit ≈ $0.005 (based on Kie.AI credit packs).
 *
 * Docs: https://docs.kie.ai/
 * Pricing: https://kie.ai/pricing
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export type KieModelCapability = 'text' | 'image' | 'video';

export interface KieModelInfo {
  /** The exact model ID used in the API call */
  id: string;
  /** Human-readable label */
  label: string;
  /** Capability category */
  capability: KieModelCapability;
  /** Vendor / family name */
  vendor: string;
  /** What the model does */
  description: string;
  /** Pricing notes in credits & approx USD */
  pricing: string;
  /** Whether the model uses createTask (async) vs chat endpoint */
  async: boolean;
}

// ─── IMAGE Models ────────────────────────────────────────────────────────────

export const KIE_IMAGE_MODELS: KieModelInfo[] = [
  // ── Flux-2 (Black Forest Labs) ───────────────────────────────────────────
  {
    id: 'flux-2/pro-text-to-image',
    label: 'Flux 2 Pro — Text to Image',
    capability: 'image',
    vendor: 'Flux-2',
    description: 'High-quality text-to-image generation with strong prompt adherence',
    pricing: '~5 credits/image (~$0.025)',
    async: true,
  },
  {
    id: 'flux-2/pro-image-to-image',
    label: 'Flux 2 Pro — Image to Image',
    capability: 'image',
    vendor: 'Flux-2',
    description: 'Transform an existing image guided by a text prompt',
    pricing: '~5 credits/image (~$0.025)',
    async: true,
  },
  {
    id: 'flux-2/flex-text-to-image',
    label: 'Flux 2 Flex — Text to Image',
    capability: 'image',
    vendor: 'Flux-2',
    description: 'Flexible text-to-image with aspect ratio control',
    pricing: '~3 credits/image (~$0.015)',
    async: true,
  },
  {
    id: 'flux-2/flex-image-to-image',
    label: 'Flux 2 Flex — Image to Image',
    capability: 'image',
    vendor: 'Flux-2',
    description: 'Flexible image-to-image editing',
    pricing: '~3 credits/image (~$0.015)',
    async: true,
  },

  // ── Seedream (ByteDance) ─────────────────────────────────────────────────
  {
    id: 'bytedance/seedream',
    label: 'Seedream v3',
    capability: 'image',
    vendor: 'ByteDance',
    description: 'ByteDance Seedream v3 text-to-image generation',
    pricing: '~4 credits/image (~$0.02)',
    async: true,
  },
  {
    id: 'bytedance/seedream-v4-text-to-image',
    label: 'Seedream v4 — Text to Image',
    capability: 'image',
    vendor: 'ByteDance',
    description: 'Latest Seedream v4 with enhanced detail and typography',
    pricing: '~5 credits/image (~$0.025)',
    async: true,
  },
  {
    id: 'bytedance/seedream-v4-edit',
    label: 'Seedream v4 — Edit',
    capability: 'image',
    vendor: 'ByteDance',
    description: 'Image editing powered by Seedream v4',
    pricing: '~5 credits/image (~$0.025)',
    async: true,
  },
  {
    id: 'seedream/4.5-text-to-image',
    label: 'Seedream 4.5 — Text to Image',
    capability: 'image',
    vendor: 'ByteDance',
    description: 'Newest Seedream 4.5 text-to-image model',
    pricing: '~6 credits/image (~$0.03)',
    async: true,
  },

  // ── Google Imagen ────────────────────────────────────────────────────────
  {
    id: 'google/imagen4',
    label: 'Google Imagen 4',
    capability: 'image',
    vendor: 'Google',
    description: 'Google Imagen 4 with photorealistic output',
    pricing: '~5 credits/image (~$0.025)',
    async: true,
  },
  {
    id: 'google/imagen4-ultra',
    label: 'Google Imagen 4 Ultra',
    capability: 'image',
    vendor: 'Google',
    description: 'Higher-quality Imagen 4 Ultra variant',
    pricing: '~10 credits/image (~$0.05)',
    async: true,
  },
  {
    id: 'google/nano-banana-edit',
    label: 'Nano Banana — Edit',
    capability: 'image',
    vendor: 'Google',
    description: 'Google Nano Banana image editing model',
    pricing: '~4 credits/image (~$0.02)',
    async: true,
  },
  {
    id: 'google/pro-image-to-image',
    label: 'Nano Banana Pro — Image to Image',
    capability: 'image',
    vendor: 'Google',
    description: 'Google Nano Banana Pro image-to-image transform',
    pricing: '~6 credits/image (~$0.03)',
    async: true,
  },

  // ── Grok Imagine (xAI) ──────────────────────────────────────────────────
  {
    id: 'grok-imagine/text-to-image',
    label: 'Grok Imagine — Text to Image',
    capability: 'image',
    vendor: 'xAI',
    description: 'xAI Grok Imagine text-to-image',
    pricing: '~5 credits/image (~$0.025)',
    async: true,
  },
  {
    id: 'grok-imagine/image-to-image',
    label: 'Grok Imagine — Image to Image',
    capability: 'image',
    vendor: 'xAI',
    description: 'xAI Grok Imagine image-to-image editing',
    pricing: '~5 credits/image (~$0.025)',
    async: true,
  },

  // ── Ideogram ─────────────────────────────────────────────────────────────
  {
    id: 'ideogram/v3-text-to-image',
    label: 'Ideogram v3 — Text to Image',
    capability: 'image',
    vendor: 'Ideogram',
    description: 'Ideogram v3 with excellent text rendering in images',
    pricing: '~5 credits/image (~$0.025)',
    async: true,
  },
  {
    id: 'ideogram/character',
    label: 'Ideogram — Character',
    capability: 'image',
    vendor: 'Ideogram',
    description: 'Character-focused image generation',
    pricing: '~5 credits/image (~$0.025)',
    async: true,
  },
  {
    id: 'ideogram/v3-reframe',
    label: 'Ideogram v3 — Reframe',
    capability: 'image',
    vendor: 'Ideogram',
    description: 'Reframe and resize images while maintaining context',
    pricing: '~3 credits/image (~$0.015)',
    async: true,
  },

  // ── Qwen (Alibaba) ──────────────────────────────────────────────────────
  {
    id: 'qwen/text-to-image',
    label: 'Qwen — Text to Image',
    capability: 'image',
    vendor: 'Alibaba',
    description: 'Alibaba Qwen text-to-image model',
    pricing: '~4 credits/image (~$0.02)',
    async: true,
  },
  {
    id: 'qwen/image-edit',
    label: 'Qwen — Image Edit',
    capability: 'image',
    vendor: 'Alibaba',
    description: 'Alibaba Qwen image editing model',
    pricing: '~4 credits/image (~$0.02)',
    async: true,
  },

  // ── Recraft (Utility) ───────────────────────────────────────────────────
  {
    id: 'recraft/crisp-upscale',
    label: 'Recraft — Crisp Upscale',
    capability: 'image',
    vendor: 'Recraft',
    description: 'AI-powered crisp image upscaling',
    pricing: '~2 credits/image (~$0.01)',
    async: true,
  },
  {
    id: 'recraft/remove-background',
    label: 'Recraft — Remove Background',
    capability: 'image',
    vendor: 'Recraft',
    description: 'AI background removal',
    pricing: '1 credit/image (~$0.005)',
    async: true,
  },
];

// ─── VIDEO Models ────────────────────────────────────────────────────────────

export const KIE_VIDEO_MODELS: KieModelInfo[] = [
  // ── Kling (Kuaishou) ─────────────────────────────────────────────────────
  {
    id: 'kling/v2-1-pro',
    label: 'Kling v2.1 Pro',
    capability: 'video',
    vendor: 'Kuaishou',
    description: 'High-quality video generation (text or image-to-video)',
    pricing: '55–110 credits/video (~$0.275–$0.55), 5–10 sec',
    async: true,
  },
  {
    id: 'kling/v2-1-standard',
    label: 'Kling v2.1 Standard',
    capability: 'video',
    vendor: 'Kuaishou',
    description: 'Standard quality video generation at lower cost',
    pricing: '35–70 credits/video (~$0.175–$0.35), 5–10 sec',
    async: true,
  },
  {
    id: 'kling/v2-1-master-text-to-video',
    label: 'Kling v2.1 Master — Text to Video',
    capability: 'video',
    vendor: 'Kuaishou',
    description: 'Master-tier text-to-video with cinematic quality',
    pricing: '~220 credits/video (~$1.10), 5–10 sec',
    async: true,
  },
  {
    id: 'kling/v2-5-turbo-text-to-video-pro',
    label: 'Kling v2.5 Turbo Pro — Text to Video',
    capability: 'video',
    vendor: 'Kuaishou',
    description: 'Fast turbo video generation with pro quality',
    pricing: '55–110 credits/video (~$0.275–$0.55)',
    async: true,
  },
  {
    id: 'kling/text-to-video',
    label: 'Kling 2.6 — Text to Video',
    capability: 'video',
    vendor: 'Kuaishou',
    description: 'Latest Kling 2.6 text-to-video',
    pricing: '55–220 credits/video (~$0.275–$1.10), 5–10 sec',
    async: true,
  },
  {
    id: 'kling/v3-0-text-to-video',
    label: 'Kling 3.0 — Text to Video',
    capability: 'video',
    vendor: 'Kuaishou',
    description: 'Kling 3.0 with enhanced motion and detail',
    pricing: '20–40 credits/sec (~$0.10–$0.20/sec)',
    async: true,
  },

  // ── Sora 2 (OpenAI) ─────────────────────────────────────────────────────
  {
    id: 'sora-2-pro-text-to-video',
    label: 'Sora 2 Pro — Text to Video',
    capability: 'video',
    vendor: 'OpenAI',
    description: 'OpenAI Sora 2 pro-quality text-to-video',
    pricing: '35–40 credits/video (~$0.175–$0.20), 80%+ discount vs direct',
    async: true,
  },
  {
    id: 'sora-2-pro-image-to-video',
    label: 'Sora 2 Pro — Image to Video',
    capability: 'video',
    vendor: 'OpenAI',
    description: 'Animate a still image into video with Sora 2',
    pricing: '35–40 credits/video (~$0.175–$0.20)',
    async: true,
  },
  {
    id: 'sora-2-text-to-video-stable',
    label: 'Sora 2 Stable — Text to Video',
    capability: 'video',
    vendor: 'OpenAI',
    description: 'Sora 2 stable release for reliable video generation',
    pricing: '25–35 credits/video (~$0.125–$0.175)',
    async: true,
  },
  {
    id: 'sora-2-image-to-video-stable',
    label: 'Sora 2 Stable — Image to Video',
    capability: 'video',
    vendor: 'OpenAI',
    description: 'Sora 2 stable image-to-video',
    pricing: '25–35 credits/video (~$0.125–$0.175)',
    async: true,
  },

  // ── ByteDance Seaweed ────────────────────────────────────────────────────
  {
    id: 'bytedance/v1-pro-text-to-video',
    label: 'Seaweed Pro — Text to Video',
    capability: 'video',
    vendor: 'ByteDance',
    description: 'ByteDance Seaweed v1 Pro text-to-video',
    pricing: '~40 credits/video (~$0.20)',
    async: true,
  },
  {
    id: 'bytedance/v1-pro-image-to-video',
    label: 'Seaweed Pro — Image to Video',
    capability: 'video',
    vendor: 'ByteDance',
    description: 'ByteDance Seaweed v1 Pro image-to-video',
    pricing: '~40 credits/video (~$0.20)',
    async: true,
  },
  {
    id: 'bytedance/v1-lite-text-to-video',
    label: 'Seaweed Lite — Text to Video',
    capability: 'video',
    vendor: 'ByteDance',
    description: 'ByteDance Seaweed v1 Lite (faster, cheaper)',
    pricing: '~15 credits/video (~$0.075)',
    async: true,
  },
  {
    id: 'bytedance/v1-lite-image-to-video',
    label: 'Seaweed Lite — Image to Video',
    capability: 'video',
    vendor: 'ByteDance',
    description: 'ByteDance Seaweed v1 Lite image-to-video',
    pricing: '~15 credits/video (~$0.075)',
    async: true,
  },

  // ── Hailuo (MiniMax) ────────────────────────────────────────────────────
  {
    id: 'hailuo/2-3-image-to-video-pro',
    label: 'Hailuo 2.3 Pro — Image to Video',
    capability: 'video',
    vendor: 'MiniMax',
    description: 'MiniMax Hailuo 2.3 pro image-to-video',
    pricing: '~30 credits/video (~$0.15)',
    async: true,
  },
  {
    id: 'hailuo/2-3-image-to-video-standard',
    label: 'Hailuo 2.3 Standard — Image to Video',
    capability: 'video',
    vendor: 'MiniMax',
    description: 'MiniMax Hailuo 2.3 standard image-to-video',
    pricing: '~15 credits/video (~$0.075)',
    async: true,
  },

  // ── Grok Imagine Video (xAI) ────────────────────────────────────────────
  {
    id: 'grok-imagine/text-to-video',
    label: 'Grok Imagine — Text to Video',
    capability: 'video',
    vendor: 'xAI',
    description: 'xAI Grok Imagine text-to-video generation',
    pricing: '~30 credits/video (~$0.15)',
    async: true,
  },
  {
    id: 'grok-imagine/image-to-video',
    label: 'Grok Imagine — Image to Video',
    capability: 'video',
    vendor: 'xAI',
    description: 'xAI Grok Imagine image-to-video',
    pricing: '~30 credits/video (~$0.15)',
    async: true,
  },

  // ── Wan (Alibaba) ───────────────────────────────────────────────────────
  {
    id: 'wan/2-2-a14b-text-to-video-turbo',
    label: 'Wan 2.2 14B Turbo — Text to Video',
    capability: 'video',
    vendor: 'Alibaba',
    description: 'Fast Wan 2.2 14B turbo text-to-video',
    pricing: '~20 credits/video (~$0.10)',
    async: true,
  },
  {
    id: 'wan/2-6-text-to-video',
    label: 'Wan 2.6 — Text to Video',
    capability: 'video',
    vendor: 'Alibaba',
    description: 'Latest Wan 2.6 text-to-video with enhanced quality',
    pricing: '104.5–315 credits/video (~$0.52–$1.575)',
    async: true,
  },
  {
    id: 'wan/2-6-image-to-video',
    label: 'Wan 2.6 — Image to Video',
    capability: 'video',
    vendor: 'Alibaba',
    description: 'Wan 2.6 image-to-video',
    pricing: '104.5–315 credits/video (~$0.52–$1.575)',
    async: true,
  },
  {
    id: 'wan/2-6-video-to-video',
    label: 'Wan 2.6 — Video to Video',
    capability: 'video',
    vendor: 'Alibaba',
    description: 'Wan 2.6 video-to-video transformation',
    pricing: '~200 credits/video (~$1.00)',
    async: true,
  },
  {
    id: 'wan/2-2-animate-move',
    label: 'Wan 2.2 — Animate Move',
    capability: 'video',
    vendor: 'Alibaba',
    description: 'Animate an image with motion paths',
    pricing: '~25 credits/video (~$0.125)',
    async: true,
  },
  {
    id: 'wan/2-2-animate-replace',
    label: 'Wan 2.2 — Animate Replace',
    capability: 'video',
    vendor: 'Alibaba',
    description: 'Animate and replace elements in an image',
    pricing: '~25 credits/video (~$0.125)',
    async: true,
  },
];

// ─── CHAT / TEXT Models ──────────────────────────────────────────────────────

export const KIE_CHAT_MODELS: KieModelInfo[] = [
  {
    id: 'gemini-2.5-flash',
    label: 'Gemini 2.5 Flash',
    capability: 'text',
    vendor: 'Google',
    description: 'Fast Gemini 2.5 Flash for text generation',
    pricing: '15 input / 60 output credits per 1M tokens (~$0.075/$0.30)',
    async: false,
  },
  {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    capability: 'text',
    vendor: 'Google',
    description: 'Powerful Gemini 2.5 Pro for complex reasoning',
    pricing: '50 input / 200 output credits per 1M tokens (~$0.25/$1.00)',
    async: false,
  },
  {
    id: 'gemini-3-flash',
    label: 'Gemini 3 Flash',
    capability: 'text',
    vendor: 'Google',
    description: 'Next-gen Gemini 3 Flash for speed',
    pricing: '30 input / 180 output credits per 1M tokens (~$0.15/$0.90)',
    async: false,
  },
  {
    id: 'gemini-3-pro',
    label: 'Gemini 3 Pro',
    capability: 'text',
    vendor: 'Google',
    description: 'Next-gen Gemini 3 Pro for advanced tasks',
    pricing: '100 input / 700 output credits per 1M tokens (~$0.50/$3.50)',
    async: false,
  },
  {
    id: 'claude/claude-opus-4-5',
    label: 'Claude Opus 4.5',
    capability: 'text',
    vendor: 'Anthropic',
    description: 'Anthropic Claude Opus 4.5 via Kie.AI proxy',
    pricing: '~300 input / 1500 output credits per 1M tokens (~$1.50/$7.50)',
    async: false,
  },
];

// ─── Aggregate / Helpers ─────────────────────────────────────────────────────

/** All Kie.AI models in a single flat array */
export const KIE_ALL_MODELS: KieModelInfo[] = [
  ...KIE_IMAGE_MODELS,
  ...KIE_VIDEO_MODELS,
  ...KIE_CHAT_MODELS,
];

/** Quick lookup by model ID */
export const KIE_MODEL_MAP: ReadonlyMap<string, KieModelInfo> = new Map(
  KIE_ALL_MODELS.map((m) => [m.id, m]),
);

/**
 * Get all models for a specific capability.
 */
export function getKieModelsByCapability(capability: KieModelCapability): KieModelInfo[] {
  return KIE_ALL_MODELS.filter((m) => m.capability === capability);
}

/**
 * Get all model IDs for a specific capability (convenience).
 */
export function getKieModelIds(capability: KieModelCapability): string[] {
  return getKieModelsByCapability(capability).map((m) => m.id);
}

/**
 * Validate that a model ID exists in the catalog.
 */
export function isValidKieModel(modelId: string): boolean {
  return KIE_MODEL_MAP.has(modelId);
}

/**
 * Get model info by ID. Returns undefined if not found.
 */
export function getKieModelInfo(modelId: string): KieModelInfo | undefined {
  return KIE_MODEL_MAP.get(modelId);
}
