/**
 * AI Adapter — Kie.AI Implementation (v2)
 *
 * Kie.AI is an async-task–based provider:
 *   1. POST /api/v1/jobs/createTask  → returns { taskId }
 *   2. GET  /api/v1/jobs/recordInfo?taskId=xxx  → poll until state === 'success'
 *
 * All image/video models follow the same createTask → poll pattern.
 * Chat/text uses an OpenAI-compatible endpoint per model.
 *
 * Features:
 *   - Full model catalog (22+ image, 24+ video, 5+ chat models)
 *   - Pricing info attached to every model
 *   - Sliding-window rate limiter (20 req / 10s default)
 *   - Model validation against the catalog
 *
 * Docs: https://docs.kie.ai/
 */

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
  TaskState,
} from '../types';
import { AIAdapterError, CapabilityNotSupportedError } from '../types';
import { RateLimiter, DEFAULT_RATE_LIMITS } from '../rate-limiter';
import type { RateLimiterConfig, RateLimiterStatus } from '../rate-limiter';
import {
  KIE_MODEL_MAP,
  KIE_ALL_MODELS,
  getKieModelsByCapability,
  getKieModelIds,
  isValidKieModel,
  getKieModelInfo,
} from '../kieai-models';
import type { KieModelInfo } from '../kieai-models';

// ─── Default models (can be overridden in config) ────────────────────────────

const DEFAULT_MODELS = {
  text: 'gemini-2.5-flash',           // Kie.AI hosts Gemini as a chat model
  image: 'flux-2/pro-text-to-image',  // Flux-2 for image generation
  video: 'kling/v2-1-pro',            // Kling for video generation
} as const;

// ─── Constants ───────────────────────────────────────────────────────────────

const KIE_BASE_URL = 'https://api.kie.ai';
const KIE_TASK_ENDPOINT = `${KIE_BASE_URL}/api/v1/jobs/createTask`;
const KIE_POLL_ENDPOINT = `${KIE_BASE_URL}/api/v1/jobs/recordInfo`;

// ─── Adapter ─────────────────────────────────────────────────────────────────

export class KieAIAdapter implements IAIAdapter {
  readonly name = 'KieAI';
  readonly provider = 'kieai' as const;

  private readonly apiKey: string;
  private readonly models: { text: string; image: string; video: string };
  private readonly pollingInterval: number;
  private readonly maxPollingAttempts: number;
  private readonly rateLimiter: RateLimiter;

  constructor(config: AIProviderConfig) {
    this.apiKey = config.apiKey;
    this.models = {
      text: config.models?.text ?? DEFAULT_MODELS.text,
      image: config.models?.image ?? DEFAULT_MODELS.image,
      video: config.models?.video ?? DEFAULT_MODELS.video,
    };
    this.pollingInterval = config.pollingInterval ?? 5_000;
    this.maxPollingAttempts = config.maxPollingAttempts ?? 60;

    // Initialize rate limiter from config or use provider defaults
    const rlConfig: RateLimiterConfig = config.rateLimit ?? DEFAULT_RATE_LIMITS.kieai;
    this.rateLimiter = new RateLimiter(rlConfig);

    // Warn (but don't crash) if configured models aren't in the catalog
    this.validateConfiguredModels();
  }

  // ── Capability discovery ─────────────────────────────────────────────────

  getSupportedCapabilities(): AICapability[] {
    return ['text', 'image', 'video'];
  }

  supportsCapability(capability: AICapability): boolean {
    return this.getSupportedCapabilities().includes(capability);
  }

  // ── Model Discovery (unique to KieAI adapter) ───────────────────────────

  /**
   * List all available models, optionally filtered by capability.
   */
  getAvailableModels(capability?: AICapability): KieModelInfo[] {
    if (capability) {
      return getKieModelsByCapability(capability);
    }
    return [...KIE_ALL_MODELS];
  }

  /**
   * Get model IDs for a capability.
   */
  getModelIds(capability: AICapability): string[] {
    return getKieModelIds(capability);
  }

  /**
   * Get detailed info about a specific model.
   */
  getModelInfo(modelId: string): KieModelInfo | undefined {
    return getKieModelInfo(modelId);
  }

  /**
   * Check rate limiter status without consuming a slot.
   */
  getRateLimitStatus(): RateLimiterStatus {
    return this.rateLimiter.getStatus();
  }

  /**
   * Get the currently configured default models.
   */
  getConfiguredModels(): { text: string; image: string; video: string } {
    return { ...this.models };
  }

  // ── Text Generation ──────────────────────────────────────────────────────

  async generateText(request: TextGenerationRequest): Promise<TextGenerationResponse> {
    if (!this.supportsCapability('text')) {
      throw new CapabilityNotSupportedError('kieai', 'text');
    }

    // Rate limit check
    await this.rateLimiter.acquire('kieai');

    const model = this.models.text;
    const url = `${KIE_BASE_URL}/${model}/v1/chat/completions`;

    // Build messages array (OpenAI-compatible format used by kie.ai chat models)
    const messages: Array<{ role: string; content: string }> = [];

    if (request.systemInstruction) {
      messages.push({ role: 'system', content: request.systemInstruction });
    }
    messages.push({ role: 'user', content: request.prompt });

    const body = {
      messages,
      stream: false,
      ...(request.temperature !== undefined && { temperature: request.temperature }),
      ...(request.maxTokens !== undefined && { max_tokens: request.maxTokens }),
    };

    const res = await this.fetchJSON<KieChatResponse>(url, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    const content = res.choices?.[0]?.message?.content ?? '';

    return {
      text: content,
      model: res.model ?? model,
      provider: 'kieai',
      usage: res.usage
        ? {
            promptTokens: res.usage.prompt_tokens,
            completionTokens: res.usage.completion_tokens,
            totalTokens: res.usage.total_tokens,
          }
        : undefined,
    };
  }

  // ── Image Generation ─────────────────────────────────────────────────────

  async generateImage(
    request: ImageGenerationRequest,
    modelOverride?: string,
  ): Promise<ImageGenerationResponse> {
    if (!this.supportsCapability('image')) {
      throw new CapabilityNotSupportedError('kieai', 'image');
    }

    const model = modelOverride ?? this.models.image;
    this.assertValidModel(model, 'image');

    // Rate limit check
    await this.rateLimiter.acquire('kieai');

    const taskBody = {
      model,
      input: {
        prompt: request.prompt,
        // Kie.AI requires aspect_ratio — default to 1:1
        aspect_ratio: request.aspectRatio ?? '1:1',
        ...(request.negativePrompt && { negative_prompt: request.negativePrompt }),
      },
    };

    const { taskId } = await this.createTask(taskBody);
    const result = await this.pollUntilDone(taskId);

    return {
      images: (result.resultUrls ?? []).map((url) => ({
        url,
        mimeType: 'image/png',
      })),
      model,
      provider: 'kieai',
    };
  }

  // ── Video Generation ─────────────────────────────────────────────────────

  async generateVideo(
    request: VideoGenerationRequest,
    modelOverride?: string,
  ): Promise<VideoGenerationResponse> {
    if (!this.supportsCapability('video')) {
      throw new CapabilityNotSupportedError('kieai', 'video');
    }

    const model = modelOverride ?? this.models.video;
    this.assertValidModel(model, 'video');

    // Rate limit check
    await this.rateLimiter.acquire('kieai');

    const taskBody = {
      model,
      input: {
        prompt: request.prompt,
        // Kie.AI requires aspect_ratio — default to 16:9 for video
        aspect_ratio: request.aspectRatio ?? '16:9',
        ...(request.imageUrl && { image_url: request.imageUrl }),
        ...(request.durationSeconds && { duration: String(request.durationSeconds) }),
        ...(request.negativePrompt && { negative_prompt: request.negativePrompt }),
      },
    };

    const { taskId } = await this.createTask(taskBody);
    const result = await this.pollUntilDone(taskId);

    return {
      videos: (result.resultUrls ?? []).map((url) => ({
        url,
        mimeType: 'video/mp4',
      })),
      model,
      provider: 'kieai',
    };
  }

  // ── Internals ────────────────────────────────────────────────────────────

  /**
   * POST /api/v1/jobs/createTask
   * Returns the taskId for async polling.
   */
  private async createTask(body: Record<string, unknown>): Promise<{ taskId: string }> {
    const res = await this.fetchJSON<KieCreateTaskResponse>(KIE_TASK_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    if (res.code !== 200 || !res.data?.taskId) {
      throw new AIAdapterError(
        `Failed to create task: ${res.msg ?? 'unknown error'}`,
        'kieai',
        'TASK_CREATION_FAILED',
        res.code,
      );
    }

    return { taskId: res.data.taskId };
  }

  /**
   * GET /api/v1/jobs/recordInfo?taskId=xxx
   * Polls until state === 'success' or 'fail'.
   * Polling calls are NOT rate-limited (they're lightweight status checks).
   */
  private async pollUntilDone(taskId: string): Promise<KiePollResult> {
    for (let attempt = 0; attempt < this.maxPollingAttempts; attempt++) {
      const res = await this.fetchJSON<KiePollResponse>(
        `${KIE_POLL_ENDPOINT}?taskId=${taskId}`,
        { method: 'GET' },
      );

      const state: TaskState = res.data?.state as TaskState;

      if (state === 'success') {
        const parsed = res.data?.resultJson
          ? (JSON.parse(res.data.resultJson) as { resultUrls?: string[] })
          : { resultUrls: [] };

        return { state: 'success', resultUrls: parsed.resultUrls ?? [] };
      }

      if (state === 'fail') {
        throw new AIAdapterError(
          `Task ${taskId} failed: ${res.data?.failMsg ?? 'unknown'}`,
          'kieai',
          'TASK_FAILED',
        );
      }

      // Still processing → wait
      await this.sleep(this.pollingInterval);
    }

    throw new AIAdapterError(
      `Task ${taskId} timed out after ${this.maxPollingAttempts} attempts`,
      'kieai',
      'TASK_TIMEOUT',
    );
  }

  /**
   * Validate configured models against the catalog on construction.
   * Logs warnings but does not throw — the model might be newly added.
   */
  private validateConfiguredModels(): void {
    for (const [capability, modelId] of Object.entries(this.models)) {
      if (!isValidKieModel(modelId)) {
        console.warn(
          `[KieAI] Model "${modelId}" for ${capability} is not in the catalog. ` +
          `It may be a new model not yet cataloged, or a typo. ` +
          `Available ${capability} models: ${getKieModelIds(capability as AICapability).join(', ')}`,
        );
      }
    }
  }

  /**
   * Assert that a model ID is valid for its capability before making an API call.
   * Throws if the model is known but assigned to the wrong capability.
   */
  private assertValidModel(modelId: string, expectedCapability: AICapability): void {
    const info = KIE_MODEL_MAP.get(modelId);
    if (info && info.capability !== expectedCapability) {
      throw new AIAdapterError(
        `Model "${modelId}" is a ${info.capability} model, ` +
        `but was used for ${expectedCapability} generation. ` +
        `Use one of: ${getKieModelIds(expectedCapability).slice(0, 5).join(', ')}…`,
        'kieai',
        'MODEL_CAPABILITY_MISMATCH',
      );
    }
    // If model is not in the catalog at all, we allow it through (might be new)
  }

  /** Generic fetch wrapper with auth headers */
  private async fetchJSON<T>(url: string, init: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        ...(init.headers as Record<string, string>),
      },
    });

    if (!response.ok) {
      // Handle rate limit responses from the server itself
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        throw new AIAdapterError(
          `Rate limited by Kie.AI (429). Retry after ${retryAfter ?? 'unknown'} seconds.`,
          'kieai',
          'PROVIDER_RATE_LIMITED',
          429,
        );
      }

      throw new AIAdapterError(
        `HTTP ${response.status}: ${response.statusText}`,
        'kieai',
        'HTTP_ERROR',
        response.status,
      );
    }

    return (await response.json()) as T;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// ─── Kie.AI Response Types ──────────────────────────────────────────────────

interface KieChatResponse {
  id?: string;
  object?: string;
  model?: string;
  choices?: Array<{
    index: number;
    message: { role: string; content: string };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

interface KieCreateTaskResponse {
  code: number;
  msg?: string;
  data?: { taskId: string };
}

interface KiePollResponse {
  code: number;
  message?: string;
  data?: {
    taskId: string;
    model: string;
    state: string;
    resultJson?: string;
    failCode?: string;
    failMsg?: string;
  };
}

interface KiePollResult {
  state: 'success';
  resultUrls: string[];
}
