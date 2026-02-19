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

// Re-export for convenience
import { AuthService } from './auth.service';
import { PaymentService } from './payment.service';

/**
 * Centralized APIBook for Firebase services
 * 
 * Usage:
 * import { APIBook } from '@/lib/firebase/services';
 * const result = await APIBook.auth.loginWithEmail(email, password);
 * const payment = await APIBook.payment.createPayment(paymentData);
 */
export const APIBook = {
  auth: AuthService,
  payment: PaymentService,
} as const;

/**
 * Default export for direct service access
 */
export default APIBook;
