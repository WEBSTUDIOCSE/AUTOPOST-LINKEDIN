/**
 * Firebase Services APIBook
 * Central export point for Firebase services
 */

// Import auth service
export { AuthService } from './auth.service';

// Import payment service
export { PaymentService } from './payment.service';

// Import types
export type { AppUser } from './auth.service';
export type { PaymentRecord } from './payment.service';
export type { ApiResponse } from '../handler';

// Re-export AI adapter for convenience
export { createAIAdapter, getAvailableProviders } from '@/lib/ai';
export { getAIConfig, getCurrentAIProvider } from '../config/environments';
export type { IAIAdapter } from '@/lib/ai';

// Re-export LinkedIn Autoposter facade
export { AutoposterAPI } from '@/lib/linkedin';

// Re-export for convenience
import { AuthService } from './auth.service';
import { PaymentService } from './payment.service';
import { createAIAdapter } from '@/lib/ai';
import { getAIConfig } from '../config/environments';
import { AutoposterAPI } from '@/lib/linkedin';

/**
 * Centralized APIBook for Firebase services
 * 
 * Usage:
 * import { APIBook } from '@/lib/firebase/services';
 * const result = await APIBook.auth.loginWithEmail(email, password);
 * const payment = await APIBook.payment.createPayment(paymentData);
 * const ai = APIBook.createAI();
 * const text = await ai.generateText({ prompt: 'Hello!' });
 * const series = await APIBook.autoposter.series.getActiveSeries(userId);
 */
export const APIBook = {
  auth: AuthService,
  payment: PaymentService,
  autoposter: AutoposterAPI,
  /** Create an AI adapter instance using the current environment's config */
  createAI: () => createAIAdapter(getAIConfig()),
} as const;

/**
 * Default export for direct service access
 */
export default APIBook;
