import type { FirebaseConfig, EnvironmentConfig, AIEnvironmentConfig } from './types';
import type { AIProvider, AIProviderConfig } from '@/lib/ai/types';

// ═══════════════════════════════════════════════════════════════════════════════
// FIREBASE CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Production Firebase Configuration
 * This is the only environment — LinkedIn Autoposter is production-only.
 * API keys are loaded from .env.local (see .env.example)
 */
const PROD_CONFIG: FirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "",
  vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "",
};

// ═══════════════════════════════════════════════════════════════════════════════
// AI PROVIDER CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * ┌────────────────────────────────────────────────────────────────────────────┐
 * │ AI PROVIDER SWITCHER                                                      │
 * │                                                                           │
 * │ Change this ONE value to switch the entire app's AI provider.             │
 * │ Supported: 'gemini' | 'kieai'                                            │
 * │                                                                           │
 * │ To add a new provider in the future:                                      │
 * │   1. Create src/lib/ai/adapters/newprovider.adapter.ts                    │
 * │   2. Add 'newprovider' to the AIProvider union in types.ts               │
 * │   3. Register it in adapter.factory.ts                                    │
 * │   4. Add its config below                                                │
 * └────────────────────────────────────────────────────────────────────────────┘
 */
export const AI_PROVIDER: AIProvider = 'gemini';

/**
 * Gemini AI Configuration
 * Docs: https://ai.google.dev/gemini-api/docs
 * 
 * Models:
 *   text  → gemini-2.5-flash                (fast, stable text generation)
 *   image → gemini-2.5-flash-image           (Nano Banana — native image gen via generateContent)
 *   video → veo-3.1-generate-preview         (Veo 3.1 — native audio, 720p/1080p/4K)
 * 
 * Imagen models (imagen-4.0-*) use a separate generateImages API — auto-detected by adapter.
 * 
 * Rate Limit: 15 RPM free tier (configured with buffer of 1)
 */
const GEMINI_CONFIG: AIProviderConfig = {
  provider: 'gemini',
  apiKey: process.env.GEMINI_API_KEY || '',
  models: {
    text: 'gemini-2.5-flash',
    image: 'gemini-2.5-flash-image',
    video: 'veo-3.1-generate-preview',
  },
  pollingInterval: 10000,   // 10s – Veo video gen is slow
  maxPollingAttempts: 60,   // 10min max wait
  rateLimit: {
    maxRequests: 14,        // 15 RPM free tier minus 1 buffer
    windowMs: 60_000,       // 60 seconds
    waitForSlot: true,
    maxWaitMs: 60_000,
  },
};

/**
 * Kie.AI Configuration
 * Docs: https://docs.kie.ai/
 * 
 * All generation tasks are async (createTask → poll recordInfo).
 * Chat/text uses OpenAI-compatible endpoints.
 * 
 * Default Models (override per-call or per-environment):
 *   text  → gemini-2.5-flash             (Kie proxies Gemini chat)
 *   image → flux-2/pro-text-to-image     (Flux-2 image generation)
 *   video → kling/v2-1-pro               (Kling video generation)
 * 
 * Full catalog: 22+ image, 24+ video, 5+ chat models.
 * See src/lib/ai/kieai-models.ts for all models + pricing.
 * 
 * Rate Limit: 20 req/10s official (configured with buffer of 2)
 */
const KIEAI_CONFIG: AIProviderConfig = {
  provider: 'kieai',
  apiKey: process.env.KIEAI_API_KEY || '',
  models: {
    text: 'gemini-2.5-flash',
    image: 'flux-2/pro-text-to-image',
    video: 'kling/v2-1-pro',
  },
  pollingInterval: 5000,    // 5s – check task status
  maxPollingAttempts: 60,   // 5min max wait
  rateLimit: {
    maxRequests: 18,        // 20 official minus 2 buffer
    windowMs: 10_000,       // 10 seconds
    waitForSlot: true,
    maxWaitMs: 30_000,
  },
};

/** Map of all provider configs */
export const AI_CONFIGS: Record<AIProvider, AIProviderConfig> = {
  gemini: GEMINI_CONFIG,
  kieai: KIEAI_CONFIG,
};

// ═══════════════════════════════════════════════════════════════════════════════
// AI ENVIRONMENT CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Production AI Configuration
 * Uses whatever AI_PROVIDER is set to above.
 */
const PROD_AI_CONFIG: AIEnvironmentConfig = {
  provider: AI_PROVIDER,
  providerConfig: AI_CONFIGS[AI_PROVIDER],
};

// ═══════════════════════════════════════════════════════════════════════════════
// ENVIRONMENT CONFIGURATIONS MAP
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Single environment — production only.
 */
export const ENVIRONMENTS: Record<'PROD', EnvironmentConfig> = {
  PROD: {
    name: 'PROD',
    config: PROD_CONFIG,
    ai: PROD_AI_CONFIG,
  },
};

/**
 * Always production — LinkedIn Autoposter has no UAT environment.
 */
export const IS_PRODUCTION = true;

// ═══════════════════════════════════════════════════════════════════════════════
// GETTERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get current environment configuration (always PROD)
 */
export const getCurrentEnvironment = (): EnvironmentConfig => {
  return ENVIRONMENTS.PROD;
};

/**
 * Get current Firebase config
 */
export const getCurrentFirebaseConfig = (): FirebaseConfig => {
  return getCurrentEnvironment().config;
};

/**
 * Get the AI provider config for the current environment.
 * Pass this directly to `createAIAdapter()`.
 * 
 * @example
 * ```ts
 * import { createAIAdapter, getAIConfig } from '@/lib/ai';
 * const adapter = createAIAdapter(getAIConfig());
 * ```
 */
export const getAIConfig = (): AIProviderConfig => {
  return getCurrentEnvironment().ai.providerConfig;
};

/**
 * Get the current AI provider name (e.g. 'gemini' or 'kieai')
 */
export const getCurrentAIProvider = (): AIProvider => {
  return getCurrentEnvironment().ai.provider;
};

/**
 * Verify and log current environment configuration
 */
export const verifyEnvironmentConfiguration = (): void => {
  const environment = getCurrentEnvironment();
  const config = getCurrentFirebaseConfig();
  
  // Environment verification removed for production
}; 