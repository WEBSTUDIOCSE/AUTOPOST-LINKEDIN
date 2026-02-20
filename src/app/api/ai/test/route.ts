/**
 * AI Test API Route — POST /api/ai/test
 *
 * Security measures:
 *   - Auth check: only authenticated users
 *   - Input validation: strict types, length limits
 *   - Model whitelist: rejects unknown models
 *   - Error sanitization: never leaks internal stack traces
 *   - Rate limiting: enforced inside the adapter layer
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/server';
import {
  createAIAdapter,
  getAIConfig,
  KIE_MODEL_MAP,
  AIAdapterError,
} from '@/lib/ai';
import type { AIProvider, AIProviderConfig } from '@/lib/ai';
import { AI_CONFIGS } from '@/lib/firebase/config/environments';

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_PROMPT_LENGTH = 2000;
const MAX_SYSTEM_INSTRUCTION_LENGTH = 500;
const MAX_IMAGE_URL_LENGTH = 500;
const VALID_CAPABILITIES = ['text', 'image', 'video'] as const;
const VALID_PROVIDERS = ['gemini', 'kieai'] as const;
const VALID_ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '21:9'];

type AllowedCapability = (typeof VALID_CAPABILITIES)[number];
type AllowedProvider = (typeof VALID_PROVIDERS)[number];

// ─── Request Body Type ───────────────────────────────────────────────────────

interface TestRequestBody {
  capability: AllowedCapability;
  provider?: AllowedProvider;
  model?: string;
  prompt: string;
  systemInstruction?: string;
  temperature?: number;
  maxTokens?: number;
  aspectRatio?: string;
  negativePrompt?: string;
  durationSeconds?: number;
  imageUrl?: string;
}

// ─── GET — model catalog + provider status ───────────────────────────────────

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const config = getAIConfig();
  return NextResponse.json({
    currentProvider: config.provider,
    supportedCapabilities: ['text', 'image', 'video'],
    configuredModels: config.models,
  });
}

// ─── POST — run a test generation ────────────────────────────────────────────

export async function POST(request: NextRequest) {
  // 1. Auth guard
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // 2. Parse JSON
  let body: TestRequestBody;
  try {
    body = (await request.json()) as TestRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // 3. Validate required fields
  if (!body.capability || !VALID_CAPABILITIES.includes(body.capability)) {
    return NextResponse.json(
      { error: `capability must be one of: ${VALID_CAPABILITIES.join(', ')}` },
      { status: 400 },
    );
  }

  if (!body.prompt || typeof body.prompt !== 'string') {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
  }

  // 4. Sanitize / length-limit inputs
  const prompt = body.prompt.trim().slice(0, MAX_PROMPT_LENGTH);
  const systemInstruction = body.systemInstruction?.trim().slice(0, MAX_SYSTEM_INSTRUCTION_LENGTH);
  const negativePrompt = body.negativePrompt?.trim().slice(0, MAX_PROMPT_LENGTH);
  const imageUrl = body.imageUrl?.trim().slice(0, MAX_IMAGE_URL_LENGTH);
  const aspectRatio = VALID_ASPECT_RATIOS.includes(body.aspectRatio ?? '')
    ? body.aspectRatio
    : undefined;
  const temperature =
    typeof body.temperature === 'number'
      ? Math.max(0, Math.min(2, body.temperature))
      : undefined;
  const maxTokens =
    typeof body.maxTokens === 'number'
      ? Math.max(1, Math.min(8192, Math.floor(body.maxTokens)))
      : undefined;
  const durationSeconds =
    typeof body.durationSeconds === 'number'
      ? Math.max(1, Math.min(30, Math.floor(body.durationSeconds)))
      : undefined;

  // 5. Resolve provider config
  const requestedProvider: AllowedProvider =
    body.provider && VALID_PROVIDERS.includes(body.provider) ? body.provider : 'kieai';

  const baseConfig = AI_CONFIGS[requestedProvider as AIProvider];
  if (!baseConfig) {
    return NextResponse.json({ error: `Unknown provider: ${requestedProvider}` }, { status: 400 });
  }

  // 6. Validate model override (only for kieai where we have a catalog)
  let modelOverride: string | undefined;
  if (body.model && typeof body.model === 'string') {
    const clean = body.model.trim();
    if (requestedProvider === 'kieai' && !KIE_MODEL_MAP.has(clean)) {
      return NextResponse.json(
        { error: `Unknown model "${clean}" for provider kieai` },
        { status: 400 },
      );
    }
    modelOverride = clean;
  }

  // Build config with model override applied
  const config: AIProviderConfig = {
    ...baseConfig,
    ...(modelOverride && {
      models: {
        ...baseConfig.models,
        [body.capability]: modelOverride,
      },
    }),
  };

  // 7. Run generation
  try {
    const adapter = createAIAdapter(config);
    const startTime = Date.now();
    let result: unknown;

    switch (body.capability) {
      case 'text':
        result = await adapter.generateText({ prompt, systemInstruction, temperature, maxTokens });
        break;
      case 'image':
        result = await adapter.generateImage({ prompt, aspectRatio, negativePrompt });
        break;
      case 'video':
        result = await adapter.generateVideo({
          prompt,
          aspectRatio,
          negativePrompt,
          durationSeconds,
          imageUrl,
        });
        break;
    }

    return NextResponse.json({
      status: 'success',
      provider: requestedProvider,
      capability: body.capability,
      durationMs: Date.now() - startTime,
      result,
    });
  } catch (error) {
    if (error instanceof AIAdapterError) {
      return NextResponse.json(
        {
          status: 'error',
          code: error.code,
          // Safe user-facing message (no stack traces)
          error: sanitizeErrorMessage(error.message),
        },
        { status: error.statusCode ?? 500 },
      );
    }
    // Generic fallback — never leak internals
    return NextResponse.json({ status: 'error', error: 'Generation failed. Please try again.' }, { status: 500 });
  }
}

/** Strip any internal file-system paths from error messages before sending to client */
function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/[A-Za-z]:\\[^\s]*/g, '[path]')                // Windows paths (C:\...)
    .replace(/(?:^|\s)\/(?:home|usr|var|tmp|etc|opt)[^\s]*/g, '[path]')  // Unix absolute paths
    .slice(0, 500);
}
