/**
 * AI Test API Route — POST /api/ai/test
 *
 * Security measures:
 *   - Auth check: only authenticated users
 *   - Input validation: strict types, length limits
 *   - Model whitelist: rejects unknown models (both KieAI AND Gemini)
 *   - imageUrl scheme validation: only gs:// and https:// allowed
 *   - Prompt safety pre-filter: blocks known jailbreak / injection patterns
 *   - Audit logging: every request logged with userId, promptHash, status
 *   - Error sanitization: never leaks internal stack traces, SDK URLs, or keys
 *   - Rate limiting + circuit breaker: enforced inside the adapter layer
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/server';
import {
  createAIAdapter,
  getAIConfig,
  KIE_MODEL_MAP,
  AIAdapterError,
  VALID_GEMINI_MODELS,
  checkAllInputsSafety,
  logAuditEntry,
} from '@/lib/ai';
import type { AIProvider, AIProviderConfig } from '@/lib/ai';
import { AI_CONFIGS } from '@/lib/firebase/config/environments';

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_PROMPT_LENGTH = 2000;
const MAX_SYSTEM_INSTRUCTION_LENGTH = 500;
const MAX_IMAGE_URL_LENGTH = 500;
const VALID_CAPABILITIES = ['text', 'image', 'video'] as const;
const VALID_PROVIDERS = ['gemini', 'kieai'] as const;
const VALID_ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3', '3:4', '4:5', '5:4', '2:3', '3:2', '21:9'];
const VALID_IMAGE_SIZES = ['1K', '2K', '4K'];
const VALID_VIDEO_RESOLUTIONS = ['720p', '1080p', '4k'];
const VALID_VIDEO_DURATIONS = [4, 6, 8];
const VALID_IMAGE_URL_SCHEMES = ['gs:', 'https:'];

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
  // New fields
  imageSize?: string;
  numberOfImages?: number;
  resolution?: string;
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
    typeof body.durationSeconds === 'number' && VALID_VIDEO_DURATIONS.includes(body.durationSeconds)
      ? body.durationSeconds
      : undefined;
  const imageSize = VALID_IMAGE_SIZES.includes(body.imageSize ?? '')
    ? body.imageSize
    : undefined;
  const numberOfImages =
    typeof body.numberOfImages === 'number'
      ? Math.max(1, Math.min(4, Math.floor(body.numberOfImages)))
      : undefined;
  const resolution = VALID_VIDEO_RESOLUTIONS.includes(body.resolution ?? '')
    ? body.resolution
    : undefined;

  // 4a. Validate imageUrl scheme — only gs:// and https:// allowed (prevents SSRF)
  let imageUrl: string | undefined;
  if (body.imageUrl && typeof body.imageUrl === 'string') {
    const trimmed = body.imageUrl.trim().slice(0, MAX_IMAGE_URL_LENGTH);
    try {
      const parsed = new URL(trimmed);
      if (!VALID_IMAGE_URL_SCHEMES.includes(parsed.protocol)) {
        return NextResponse.json(
          { error: 'imageUrl must use gs:// or https:// scheme' },
          { status: 400 },
        );
      }
      imageUrl = trimmed;
    } catch {
      return NextResponse.json(
        { error: 'imageUrl is not a valid URL' },
        { status: 400 },
      );
    }
  }

  // 4b. Prompt safety pre-filter — catch jailbreaks / injection before burning an API call
  const safetyCheck = checkAllInputsSafety(prompt, systemInstruction);
  if (!safetyCheck.safe) {
    // Determine provider + model for audit log
    const auditProvider = body.provider && VALID_PROVIDERS.includes(body.provider) ? body.provider : 'kieai';
    await logAuditEntry({
      userId: user.uid,
      capability: body.capability,
      provider: auditProvider,
      model: body.model ?? 'default',
      prompt,
      durationMs: 0,
      status: 'blocked',
      blockRule: safetyCheck.rule,
    });
    return NextResponse.json(
      { status: 'error', code: 'PROMPT_BLOCKED', error: safetyCheck.reason },
      { status: 400 },
    );
  }

  // 5. Resolve provider config
  const requestedProvider: AllowedProvider =
    body.provider && VALID_PROVIDERS.includes(body.provider) ? body.provider : 'kieai';

  const baseConfig = AI_CONFIGS[requestedProvider as AIProvider];
  if (!baseConfig) {
    return NextResponse.json({ error: `Unknown provider: ${requestedProvider}` }, { status: 400 });
  }

  // 6. Validate model override (whitelist for BOTH providers)
  let modelOverride: string | undefined;
  if (body.model && typeof body.model === 'string') {
    const clean = body.model.trim();
    if (requestedProvider === 'kieai' && !KIE_MODEL_MAP.has(clean)) {
      return NextResponse.json(
        { error: `Unknown model "${clean}" for provider kieai` },
        { status: 400 },
      );
    }
    if (requestedProvider === 'gemini' && !VALID_GEMINI_MODELS.has(clean)) {
      return NextResponse.json(
        { error: `Unknown model "${clean}" for provider gemini` },
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

  // 7. Run generation — with audit logging
  const resolvedModel = modelOverride ?? baseConfig.models?.[body.capability] ?? 'default';
  const startTime = Date.now();

  try {
    const adapter = createAIAdapter(config);
    let result: unknown;

    switch (body.capability) {
      case 'text':
        result = await adapter.generateText({ prompt, systemInstruction, temperature, maxTokens });
        break;
      case 'image':
        result = await adapter.generateImage({
          prompt,
          aspectRatio,
          negativePrompt,
          imageSize,
          numberOfImages,
        });
        break;
      case 'video':
        result = await adapter.generateVideo({
          prompt,
          aspectRatio,
          negativePrompt,
          durationSeconds,
          imageUrl,
          resolution,
        });
        break;
    }

    const durationMs = Date.now() - startTime;

    // Audit log — success
    await logAuditEntry({
      userId: user.uid,
      capability: body.capability,
      provider: requestedProvider,
      model: resolvedModel,
      prompt,
      durationMs,
      status: 'success',
    });

    return NextResponse.json({
      status: 'success',
      provider: requestedProvider,
      capability: body.capability,
      durationMs,
      result,
    });
  } catch (error) {
    const durationMs = Date.now() - startTime;

    if (error instanceof AIAdapterError) {
      // Audit log — error
      await logAuditEntry({
        userId: user.uid,
        capability: body.capability,
        provider: requestedProvider,
        model: resolvedModel,
        prompt,
        durationMs,
        status: 'error',
        errorCode: error.code,
      });

      return NextResponse.json(
        {
          status: 'error',
          code: error.code,
          error: sanitizeErrorMessage(error.message),
        },
        { status: error.statusCode ?? 500 },
      );
    }

    // Audit log — unknown error
    await logAuditEntry({
      userId: user.uid,
      capability: body.capability,
      provider: requestedProvider,
      model: resolvedModel,
      prompt,
      durationMs,
      status: 'error',
      errorCode: 'UNKNOWN',
    });

    // Generic fallback — never leak internals
    return NextResponse.json({ status: 'error', error: 'Generation failed. Please try again.' }, { status: 500 });
  }
}

/**
 * Strip internal details from error messages before sending to client.
 * Removes: file-system paths, internal API URLs, model endpoint paths,
 * API keys, raw JSON blobs, and quota details.
 */
function sanitizeErrorMessage(message: string): string {
  return message
    // Windows paths (C:\...)
    .replace(/[A-Za-z]:\\[^\s]*/g, '[path]')
    // Unix absolute paths
    .replace(/(?:^|\s)\/(?:home|usr|var|tmp|etc|opt)[^\s]*/g, ' [path]')
    // Internal API URLs
    .replace(/https?:\/\/[a-z-]+\.googleapis\.com[^\s]*/gi, '[internal-url]')
    // Model endpoint paths
    .replace(/\/v\d+(?:beta\d*)?\/models\/[^\s]*/g, '[model-endpoint]')
    // API key values
    .replace(/key=[A-Za-z0-9_-]{20,}/g, 'key=[redacted]')
    // Quota numbers (e.g. "Quota exceeded: 15 / 15 per minute")
    .replace(/quota[^.]*\d+[^.]*/gi, 'Quota limit reached')
    .slice(0, 500);
}
