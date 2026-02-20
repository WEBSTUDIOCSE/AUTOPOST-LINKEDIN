/**
 * AI Adapter - Barrel Export
 * 
 * Single import point for the entire AI adapter system.
 * 
 * Usage:
 * ```ts
 * import { createAIAdapter, getAIConfig } from '@/lib/ai';
 * 
 * const adapter = createAIAdapter(getAIConfig());
 * const text = await adapter.generateText({ prompt: 'Write a post about AI' });
 * const image = await adapter.generateImage({ prompt: 'A sunrise over mountains' });
 * const video = await adapter.generateVideo({ prompt: 'Ocean waves crashing' });
 * ```
 */

// Types
export type {
  AIProvider,
  AICapability,
  AIProviderConfig,
  TextGenerationRequest,
  TextGenerationResponse,
  ImageGenerationRequest,
  ImageGenerationResponse,
  VideoGenerationRequest,
  VideoGenerationResponse,
  GeneratedImage,
  GeneratedVideo,
  TaskStatusResponse,
  TaskState,
} from './types';

// Errors
export { AIAdapterError, CapabilityNotSupportedError } from './types';

// Interface
export type { IAIAdapter } from './adapter.interface';

// Factory
export { createAIAdapter, getAvailableProviders } from './adapter.factory';

// Rate Limiter
export { RateLimiter, DEFAULT_RATE_LIMITS } from './rate-limiter';
export type { RateLimiterConfig, RateLimiterStatus } from './rate-limiter';

// Circuit Breaker
export { CircuitBreaker, DEFAULT_CIRCUIT_CONFIG } from './circuit-breaker';
export type { CircuitBreakerConfig, CircuitBreakerStatus, CircuitState } from './circuit-breaker';

// Prompt Safety
export { checkPromptSafety, checkSystemInstructionSafety, checkAllInputsSafety } from './prompt-safety';
export type { PromptCheckResult } from './prompt-safety';

// Audit Logger
export { logAuditEntry } from './audit-logger';
export type { AuditEntry } from './audit-logger';

// Gemini Model Whitelist
export { VALID_GEMINI_MODELS } from './adapters/gemini.adapter';

// Kie.AI Model Catalog
export {
  KIE_IMAGE_MODELS,
  KIE_VIDEO_MODELS,
  KIE_CHAT_MODELS,
  KIE_ALL_MODELS,
  KIE_MODEL_MAP,
  getKieModelsByCapability,
  getKieModelIds,
  isValidKieModel,
  getKieModelInfo,
} from './kieai-models';
export type { KieModelInfo, KieModelCapability } from './kieai-models';

// Config helper (re-exported from environments for convenience)
export { getAIConfig, getCurrentAIProvider } from '../firebase/config/environments';
