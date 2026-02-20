import type { FirebaseConfig, EnvironmentConfig, AIEnvironmentConfig } from './types';
import type { AIProvider, AIProviderConfig } from '@/lib/ai/types';

// ═══════════════════════════════════════════════════════════════════════════════
// FIREBASE CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * UAT Environment Configuration
 * API keys are loaded from .env.local (see .env.example)
 */
const UAT_CONFIG: FirebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_UAT_API_KEY || "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_UAT_AUTH_DOMAIN || "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_UAT_PROJECT_ID || "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_UAT_STORAGE_BUCKET || "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_UAT_MESSAGING_SENDER_ID || "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_UAT_APP_ID || "",
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_UAT_MEASUREMENT_ID || "",
    vapidKey: process.env.NEXT_PUBLIC_FIREBASE_UAT_VAPID_KEY || ""
};

/**
 * PROD Environment Configuration
 * API keys are loaded from .env.local (see .env.example)
 */
const PROD_CONFIG: FirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_PROD_API_KEY || "",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_PROD_AUTH_DOMAIN || "",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROD_PROJECT_ID || "",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_PROD_STORAGE_BUCKET || "",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_PROD_MESSAGING_SENDER_ID || "",
  appId: process.env.NEXT_PUBLIC_FIREBASE_PROD_APP_ID || "",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_PROD_MEASUREMENT_ID || "",
  vapidKey: process.env.NEXT_PUBLIC_FIREBASE_PROD_VAPID_KEY || ""
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
 *   text  → gemini-2.5-flash-preview-05-20  (fast text generation)
 *   image → gemini-2.5-flash-preview-image  (Nano Banana – native image gen)
 *   video → veo-3.0-generate-preview        (Veo 3 – async video generation)
 * 
 * Rate Limit: 15 RPM free tier (configured with buffer of 1)
 */
const GEMINI_CONFIG: AIProviderConfig = {
  provider: 'gemini',
  apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || '',
  models: {
    text: 'gemini-2.5-flash-preview-05-20',
    image: 'gemini-2.5-flash-preview-image',
    video: 'veo-3.0-generate-preview',
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
  apiKey: process.env.NEXT_PUBLIC_KIEAI_API_KEY || '',
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
// AI ENVIRONMENT CONFIGS (per environment)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * UAT AI Configuration
 * Uses whatever AI_PROVIDER is set to above.
 * You can override per-environment if needed.
 */
const UAT_AI_CONFIG: AIEnvironmentConfig = {
  provider: AI_PROVIDER,
  providerConfig: AI_CONFIGS[AI_PROVIDER],
};

/**
 * PROD AI Configuration
 * Same provider as UAT by default. Override if needed.
 */
const PROD_AI_CONFIG: AIEnvironmentConfig = {
  provider: AI_PROVIDER,
  providerConfig: AI_CONFIGS[AI_PROVIDER],
};

// ═══════════════════════════════════════════════════════════════════════════════
// ENVIRONMENT CONFIGURATIONS MAP
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Environment configurations map
 */
export const ENVIRONMENTS: Record<'UAT' | 'PROD', EnvironmentConfig> = {
  UAT: {
    name: 'UAT',
    config: UAT_CONFIG,
    ai: UAT_AI_CONFIG,
  },
  PROD: {
    name: 'PROD',
    config: PROD_CONFIG,
    ai: PROD_AI_CONFIG,
  },
};

/**
 * Boolean environment switcher
 * Set to true for PROD, false for UAT
 */
export const IS_PRODUCTION = false;

// ═══════════════════════════════════════════════════════════════════════════════
// GETTERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get current environment configuration
 */
export const getCurrentEnvironment = (): EnvironmentConfig => {
  return IS_PRODUCTION ? ENVIRONMENTS.PROD : ENVIRONMENTS.UAT;
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