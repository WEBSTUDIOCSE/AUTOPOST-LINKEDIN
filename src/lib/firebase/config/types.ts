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
 * Environment names
 */
export type Environment = 'UAT' | 'PROD';

/**
 * Environment configuration
 */
export interface EnvironmentConfig {
  name: Environment;
  config: FirebaseConfig;
} 