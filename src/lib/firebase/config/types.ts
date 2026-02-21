import type { AIProvider, AIProviderConfig } from '@/lib/ai/types';

/**
 * Firebase configuration interface
 */
export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId: string;
  vapidKey: string; // Add VAPID key for push notifications
}

/**
 * AI provider configuration per environment
 */
export interface AIEnvironmentConfig {
  /** Which AI provider to use in this environment */
  provider: AIProvider;
  /** Full provider config (apiKey, models, polling, etc.) */
  providerConfig: AIProviderConfig;
}

/**
 * Environment names — production only
 */
export type Environment = 'PROD';

/**
 * Environment configuration
 */
export interface EnvironmentConfig {
  name: Environment;
  config: FirebaseConfig;
  ai: AIEnvironmentConfig;
} 