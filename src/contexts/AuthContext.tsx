/**
 * Authentication Context Provider
 * Manages global authentication state using Firebase Auth
 */

'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '@/lib/firebase/firebase';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Hook to access authentication context
 * Must be used within AuthProvider
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Authentication Provider Component
 * Wraps app to provide real-time auth state
 */
/** How often to proactively refresh the session cookie (50 min — tokens expire at 60 min) */
const TOKEN_REFRESH_INTERVAL_MS = 50 * 60 * 1000;

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * Sync the Firebase ID token to the server-side httpOnly cookie.
   * Silently swallows network errors so a transient failure
   * doesn't break the client-side auth state.
   */
  const syncSession = useCallback(async (firebaseUser: User | null) => {
    try {
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken(/* forceRefresh */ false);
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });
      } else {
        await fetch('/api/auth/session', { method: 'DELETE' });
      }
    } catch {
      // Network / server error — session cookie may be stale but
      // the client auth state is still correct. Next request will retry.
    }
  }, []);

  useEffect(() => {
    // Listen for authentication state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      // Sync session cookie FIRST — setLoading(false) is deliberately
      // called after the await so that no component ever sees
      // loading=false before the httpOnly cookie is written.
      // Without this ordering, redirects to protected routes race
      // ahead of the cookie and the server-side layout bounces the
      // user back to /login, creating a redirect loop.
      await syncSession(firebaseUser);
      setLoading(false);

      // Clear any previous refresh timer
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }

      // Set up proactive token refresh while logged in
      if (firebaseUser) {
        refreshTimerRef.current = setInterval(async () => {
          // getIdToken(true) forces a fresh token from Firebase
          try {
            const freshToken = await firebaseUser.getIdToken(/* forceRefresh */ true);
            await fetch('/api/auth/session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: freshToken }),
            });
          } catch {
            // Retry on next interval
          }
        }, TOKEN_REFRESH_INTERVAL_MS);
      }
    });

    return () => {
      unsubscribe();
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [syncSession]);

  const value: AuthContextType = {
    user,
    loading,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
