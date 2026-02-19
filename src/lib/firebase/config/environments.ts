import type { FirebaseConfig, EnvironmentConfig, AIEnvironmentConfig } from './types';
import type { AIProvider, AIProviderConfig } from '@/lib/ai/types';

// ═══════════════════════════════════════════════════════════════════════════════
// FIREBASE CONFIGURATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * UAT Environment Configuration
 */
const UAT_CONFIG: FirebaseConfig = {
    apiKey: "AIzaSyDr2GEwj5O4AMQF6JCAu0nhNhlezsgxHS8",
    authDomain: "env-uat-cd3c5.firebaseapp.com",
    projectId: "env-uat-cd3c5",
    storageBucket: "env-uat-cd3c5.firebasestorage.app",
    messagingSenderId: "614576728087",
    appId: "1:614576728087:web:6337d07f43cb3674001452",
    measurementId: "G-RMHPEET5ZY",
    vapidKey: "BPdx9XtofjSoMHlUewHoxrV2IcWwz3jsJY7Rl0byzte4EDYOnMfxtJogdOXlCKRAL5tYSsHc-7iuWkxWjnwo1TA"
};

/**
 * PROD Environment Configuration
 */
const PROD_CONFIG: FirebaseConfig = {
 apiKey: "AIzaSyDP7goPvbKrk1utbKISF2tJU-SwyuJdm2E",
  authDomain: "breathe-free-c1566.firebaseapp.com",
  projectId: "breathe-free-c1566",
  storageBucket: "breathe-free-c1566.firebasestorage.app",
  messagingSenderId: "169689352647",
  appId: "1:169689352647:web:00fafecc859873d4eb31e2",
  measurementId: "G-DTQR8G46W0",
  vapidKey: "BMSqnRUaslFNE6JtlzBem_04MMSmaYVAGF3IkC2xFnqJ5MMcshy3GOTbnF4TIJzURpXJ1uYzatIktOavO2ka2NE"
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
 */
const GEMINI_CONFIG: AIProviderConfig = {
  provider: 'gemini',
  apiKey: 'AIzaSyALqtd_W5D3cls27tkF7tjS82yyPx2dxt4',
  models: {
    text: 'gemini-2.5-flash-preview-05-20',
    image: 'gemini-2.5-flash-preview-image',
    video: 'veo-3.0-generate-preview',
  },
  pollingInterval: 10000,   // 10s – Veo video gen is slow
  maxPollingAttempts: 60,   // 10min max wait
};

/**
 * Kie.AI Configuration
 * Docs: https://docs.kie.ai/
 * 
 * All generation tasks are async (createTask → poll recordInfo).
 * Chat/text uses OpenAI-compatible endpoints.
 * 
 * Models:
 *   text  → gemini-2.5-flash             (Kie proxies Gemini chat)
 *   image → flux-2/pro-text-to-image     (Flux-2 image generation)
 *   video → kling/v2-1-pro               (Kling video generation)
 */
const KIEAI_CONFIG: AIProviderConfig = {
  provider: 'kieai',
  apiKey: 'efe5026451ae1f05e41487a033f7875a',
  models: {
    text: 'gemini-2.5-flash',
    image: 'flux-2/pro-text-to-image',
    video: 'kling/v2-1-pro',
  },
  pollingInterval: 5000,    // 5s – check task status
  maxPollingAttempts: 60,   // 5min max wait
};

/** Map of all provider configs */
const AI_CONFIGS: Record<AIProvider, AIProviderConfig> = {
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