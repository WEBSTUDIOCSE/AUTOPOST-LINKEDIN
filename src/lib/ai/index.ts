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

// Config helper (re-exported from environments for convenience)
export { getAIConfig, getCurrentAIProvider } from '../firebase/config/environments';
