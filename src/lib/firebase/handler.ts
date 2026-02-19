/**
 * Firebase API Handler
 * Provides standardized response format and error handling
 */

import { FirebaseError } from 'firebase/app';

/**
 * Standard API response interface
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  code?: string;
  timestamp: number;
}

/**
 * Firebase error code to user-friendly message mapping
 */
const ERROR_MESSAGES: Record<string, string> = {
  // Authentication errors
  'auth/user-not-found': 'No account found with this email address.',
  'auth/wrong-password': 'Invalid email or password.',
  'auth/email-already-in-use': 'An account already exists with this email.',
  'auth/weak-password': 'Password should be at least 6 characters long.',
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/operation-not-allowed': 'This operation is not allowed.',
  'auth/account-exists-with-different-credential': 'An account already exists with the same email but different sign-in credentials.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/requires-recent-login': 'Please sign in again to complete this action.',
  'auth/popup-closed-by-user': 'Sign-in popup was closed before completing the process.',
  'auth/cancelled-popup-request': 'Another sign-in popup is already open.',
  'auth/network-request-failed': 'Network error. Please check your connection and try again.',
  'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
  'auth/invalid-credential': 'The current password is incorrect.',
  'auth/credential-already-in-use': 'This credential is already associated with a different user account.',
  'auth/invalid-verification-code': 'The verification code is invalid.',
  'auth/invalid-verification-id': 'The verification ID is invalid.',
  
  // Firestore errors
  'firestore/permission-denied': 'You do not have permission to access this resource.',
  'firestore/not-found': 'The requested document was not found.',
  'firestore/already-exists': 'The document already exists.',
  'firestore/resource-exhausted': 'Quota exceeded. Please try again later.',
  'firestore/failed-precondition': 'The operation failed due to invalid conditions.',
  'firestore/aborted': 'The operation was aborted. Please try again.',
  'firestore/out-of-range': 'The provided value is out of range.',
  'firestore/unimplemented': 'This operation is not implemented or supported.',
  'firestore/internal': 'Internal server error. Please try again later.',
  'firestore/unavailable': 'Service is temporarily unavailable. Please try again later.',
  'firestore/data-loss': 'Unrecoverable data loss or corruption.',
  'firestore/unauthenticated': 'The request does not have valid authentication credentials.',
  'firestore/deadline-exceeded': 'The operation timed out. Please try again.',
  
  // Storage errors
  'storage/object-not-found': 'The file was not found.',
  'storage/bucket-not-found': 'Storage bucket not found.',
  'storage/project-not-found': 'Project not found.',
  'storage/quota-exceeded': 'Storage quota exceeded.',
  'storage/unauthenticated': 'Please sign in to upload files.',
  'storage/unauthorized': 'You do not have permission to upload files.',
  'storage/retry-limit-exceeded': 'Maximum retry time exceeded. Please try again.',
  'storage/invalid-checksum': 'File upload failed due to checksum mismatch.',
  'storage/canceled': 'File upload was canceled.',
  'storage/invalid-event-name': 'Invalid event name provided.',
  'storage/invalid-url': 'Invalid URL provided.',
  'storage/invalid-argument': 'Invalid argument provided.',
  'storage/no-default-bucket': 'No default storage bucket configured.',
  'storage/cannot-slice-blob': 'File upload failed.',
  'storage/server-file-wrong-size': 'File size mismatch on server.'
};

/**
 * Create a success response
 */
function createSuccessResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    error: null,
    timestamp: Date.now()
  };
}

/**
 * Create an error response
 */
function createErrorResponse<T>(
  error: string, 
  code?: string
): ApiResponse<T> {
  return {
    success: false,
    data: null,
    error,
    code,
    timestamp: Date.now()
  };
}

/**
 * Firebase API Handler
 * Wraps Firebase operations with standardized response format and error handling
 */
export async function firebaseHandler<T>(
  operation: () => Promise<T>,
  context?: string
): Promise<ApiResponse<T>> {
  try {
    // Start timing for performance monitoring
    const startTime = performance.now();
    
    // Execute the Firebase operation
    const result = await operation();
    
    // End timing
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    return createSuccessResponse(result);
    
  } catch (error) {
    // Handle Firebase errors
    if (error instanceof FirebaseError) {
      const userFriendlyMessage = ERROR_MESSAGES[error.code] || 
                                  `Firebase error: ${error.message}`;
      
      return createErrorResponse<T>(userFriendlyMessage, error.code);
    }
    
    // Handle other errors
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    
    return createErrorResponse<T>(errorMessage, 'unknown');
  }
}

/**
 * Helper function for operations that don't return data (void operations)
 */
export async function firebaseVoidHandler(
  operation: () => Promise<void>,
  context?: string
): Promise<ApiResponse<null>> {
  return firebaseHandler(async () => {
    await operation();
    return null;
  }, context);
}
