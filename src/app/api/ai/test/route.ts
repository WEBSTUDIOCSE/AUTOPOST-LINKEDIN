/**
 * AI Test Route — GET & POST /api/ai/test
 *
 * Quick way to test the AI adapter system without a UI.
 *
 * ── GET  /api/ai/test ──────────────────────────────────────────────────────
 * Returns the current provider, configured models, available model catalog,
 * and rate limiter status. No API calls are made.
 *
 * ── POST /api/ai/test ─────────────────────────────────────────────────────
 * Body JSON:
 * {
 *   "capability": "text" | "image" | "video",
 *   "prompt": "A beautiful sunset over mountains",
 *   "model": "optional-model-override",       // only for kieai image/video
 *   "aspectRatio": "16:9",                     // optional
 *   "systemInstruction": "You are helpful",    // optional, text only
 *   "temperature": 0.7,                        // optional, text only
 *   "maxTokens": 1024,                         // optional, text only
 *   "durationSeconds": 5,                      // optional, video only
 *   "imageUrl": "https://...",                 // optional, video only
 *   "negativePrompt": "blurry, low quality"    // optional
 * }
 *
 * Returns the full adapter response for the given capability.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  createAIAdapter,
  getAIConfig,
  getCurrentAIProvider,
  getAvailableProviders,
  KIE_IMAGE_MODELS,
  KIE_VIDEO_MODELS,
  KIE_CHAT_MODELS,
  AIAdapterError,
} from '@/lib/ai';

// ─── GET /api/ai/test ────────────────────────────────────────────────────────

export async function GET() {
  try {
    const config = getAIConfig();
    const adapter = createAIAdapter(config);
    const provider = getCurrentAIProvider();

    // Build response with provider info + model catalog
    const response: Record<string, unknown> = {
      status: 'ok',
      currentProvider: provider,
      availableProviders: getAvailableProviders(),
      supportedCapabilities: adapter.getSupportedCapabilities(),
      configuredModels: config.models,
      rateLimit: config.rateLimit ?? 'using provider defaults',
    };

    // If KieAI, include model catalog summary
    if (provider === 'kieai') {
      response.kieaiModelCatalog = {
        imageModels: KIE_IMAGE_MODELS.map((m) => ({
          id: m.id,
          label: m.label,
          vendor: m.vendor,
          pricing: m.pricing,
        })),
        videoModels: KIE_VIDEO_MODELS.map((m) => ({
          id: m.id,
          label: m.label,
          vendor: m.vendor,
          pricing: m.pricing,
        })),
        chatModels: KIE_CHAT_MODELS.map((m) => ({
          id: m.id,
          label: m.label,
          vendor: m.vendor,
          pricing: m.pricing,
        })),
        totalModels: {
          image: KIE_IMAGE_MODELS.length,
          video: KIE_VIDEO_MODELS.length,
          chat: KIE_CHAT_MODELS.length,
          total: KIE_IMAGE_MODELS.length + KIE_VIDEO_MODELS.length + KIE_CHAT_MODELS.length,
        },
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}

// ─── POST /api/ai/test ───────────────────────────────────────────────────────

interface TestRequestBody {
  capability: 'text' | 'image' | 'video';
  prompt: string;
  model?: string;
  aspectRatio?: string;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  durationSeconds?: number;
  imageUrl?: string;
  negativePrompt?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TestRequestBody;

    // Validate required fields
    if (!body.capability || !body.prompt) {
      return NextResponse.json(
        {
          error: 'Missing required fields: "capability" and "prompt"',
          example: {
            capability: 'text',
            prompt: 'Write a LinkedIn post about AI automation',
          },
        },
        { status: 400 },
      );
    }

    const validCapabilities = ['text', 'image', 'video'] as const;
    if (!validCapabilities.includes(body.capability)) {
      return NextResponse.json(
        {
          error: `Invalid capability "${body.capability}". Must be one of: ${validCapabilities.join(', ')}`,
        },
        { status: 400 },
      );
    }

    const config = getAIConfig();
    const adapter = createAIAdapter(config);

    if (!adapter.supportsCapability(body.capability)) {
      return NextResponse.json(
        {
          error: `Provider "${adapter.provider}" does not support "${body.capability}"`,
          supported: adapter.getSupportedCapabilities(),
        },
        { status: 400 },
      );
    }

    const startTime = Date.now();
    let result: unknown;

    switch (body.capability) {
      case 'text':
        result = await adapter.generateText({
          prompt: body.prompt,
          systemInstruction: body.systemInstruction,
          temperature: body.temperature,
          maxTokens: body.maxTokens,
        });
        break;

      case 'image':
        result = await adapter.generateImage({
          prompt: body.prompt,
          aspectRatio: body.aspectRatio,
          negativePrompt: body.negativePrompt,
        });
        break;

      case 'video':
        result = await adapter.generateVideo({
          prompt: body.prompt,
          aspectRatio: body.aspectRatio,
          durationSeconds: body.durationSeconds,
          imageUrl: body.imageUrl,
          negativePrompt: body.negativePrompt,
        });
        break;
    }

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      status: 'success',
      capability: body.capability,
      provider: adapter.provider,
      durationMs,
      result,
    });
  } catch (error) {
    if (error instanceof AIAdapterError) {
      return NextResponse.json(
        {
          status: 'error',
          provider: error.provider,
          code: error.code,
          message: error.message,
          statusCode: error.statusCode,
        },
        { status: error.statusCode ?? 500 },
      );
    }

    return NextResponse.json(
      {
        status: 'error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
