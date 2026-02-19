/**
 * AI Adapter - Factory
 * 
 * Creates the correct adapter instance based on the provider config.
 * This is the ONLY place that imports concrete adapters.
 * The rest of the app imports from the barrel `@/lib/ai` and uses the interface.
 */

import type { IAIAdapter } from './adapter.interface';
import type { AIProvider, AIProviderConfig } from './types';
import { GeminiAdapter } from './adapters/gemini.adapter';
import { KieAIAdapter } from './adapters/kieai.adapter';

/** Registry of adapter constructors keyed by provider name */
const ADAPTER_REGISTRY: Record<AIProvider, new (config: AIProviderConfig) => IAIAdapter> = {
  gemini: GeminiAdapter,
  kieai: KieAIAdapter,
};

/**
 * Create an AI adapter for the given config.
 * 
 * @example
 * ```ts
 * import { createAIAdapter } from '@/lib/ai';
 * import { getAIConfig } from '@/lib/firebase/config/environments';
 * 
 * const adapter = createAIAdapter(getAIConfig());
 * const result = await adapter.generateText({ prompt: 'Hello!' });
 * ```
 */
export function createAIAdapter(config: AIProviderConfig): IAIAdapter {
  const AdapterClass = ADAPTER_REGISTRY[config.provider];

  if (!AdapterClass) {
    throw new Error(
      `Unknown AI provider "${config.provider}". ` +
      `Supported providers: ${Object.keys(ADAPTER_REGISTRY).join(', ')}`,
    );
  }

  return new AdapterClass(config);
}

/**
 * Get a list of all registered provider keys.
 * Useful for validation or UI dropdowns.
 */
export function getAvailableProviders(): AIProvider[] {
  return Object.keys(ADAPTER_REGISTRY) as AIProvider[];
}
