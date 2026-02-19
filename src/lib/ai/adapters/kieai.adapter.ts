/**
 * AI Adapter - Kie.AI Implementation
 * 
 * Kie.AI is an async-task–based provider:
 *   1. POST /api/v1/jobs/createTask  → returns { taskId }
 *   2. GET  /api/v1/jobs/recordInfo?taskId=xxx  → poll until state === 'success'
 * 
 * All image/video models follow the same createTask → poll pattern.
 * Chat/text uses an OpenAI-compatible endpoint per model.
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

// ─── Default models (can be overridden in config) ────────────────────────────

const DEFAULT_MODELS = {
  text: 'gemini-2.5-flash',         // kie.ai hosts Gemini as a chat model
  image: 'flux-2/pro-text-to-image', // Flux-2 for image generation
  video: 'kling/v2-1-pro',           // Kling for video generation
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

  constructor(config: AIProviderConfig) {
    this.apiKey = config.apiKey;
    this.models = {
      text: config.models?.text ?? DEFAULT_MODELS.text,
      image: config.models?.image ?? DEFAULT_MODELS.image,
      video: config.models?.video ?? DEFAULT_MODELS.video,
    };
    this.pollingInterval = config.pollingInterval ?? 5000;
    this.maxPollingAttempts = config.maxPollingAttempts ?? 60;
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
      throw new CapabilityNotSupportedError('kieai', 'text');
    }

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

  async generateImage(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    if (!this.supportsCapability('image')) {
      throw new CapabilityNotSupportedError('kieai', 'image');
    }

    const model = this.models.image;

    const taskBody = {
      model,
      input: {
        prompt: request.prompt,
        ...(request.aspectRatio && { aspect_ratio: request.aspectRatio }),
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

  async generateVideo(request: VideoGenerationRequest): Promise<VideoGenerationResponse> {
    if (!this.supportsCapability('video')) {
      throw new CapabilityNotSupportedError('kieai', 'video');
    }

    const model = this.models.video;

    const taskBody = {
      model,
      input: {
        prompt: request.prompt,
        ...(request.imageUrl && { image_url: request.imageUrl }),
        ...(request.durationSeconds && { duration: String(request.durationSeconds) }),
        ...(request.negativePrompt && { negative_prompt: request.negativePrompt }),
        ...(request.aspectRatio && { aspect_ratio: request.aspectRatio }),
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
