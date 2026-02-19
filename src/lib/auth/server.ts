/**
 * Server-Side Authentication Utilities
 * For use in Server Components and Server Actions
 */

import { cookies } from 'next/headers';
import { cache } from 'react';

export interface ServerUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
}

/**
 * Get current user on server-side
 * Uses React cache to avoid multiple reads per request
 */
export const getCurrentUser = cache(async (): Promise<ServerUser | null> => {
  try {
    const cookieStore = await cookies();
    
    // Check for Firebase auth cookie
    const authToken = cookieStore.get('firebaseAuthToken')?.value;
    const userData = cookieStore.get('userData')?.value;

    if (!authToken) {
      return null;
    }

    if (!userData) {
      return null;
    }

    const user = JSON.parse(userData);
    return user;
  } catch (error) {
    // During build, cookies() throws DYNAMIC_SERVER_USAGE - this is expected
    if (error && typeof error === 'object' && 'digest' in error && error.digest === 'DYNAMIC_SERVER_USAGE') {
      return null;
    }
    console.error('[Auth] Error getting current user:', error);
    return null;
  }
});

/**
 * Require authentication - throws redirect if not authenticated
 */
export async function requireAuth(): Promise<ServerUser> {
  const user = await getCurrentUser();
  
  if (!user) {
    throw new Error('Unauthorized');
  }
  
  return user;
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return user !== null;
}
