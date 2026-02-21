/**
 * Authentication Context Provider
 * Manages global authentication state using Firebase Auth
 */

'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
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
  /**
   * Sync the Firebase ID token to the server-side httpOnly cookie.
   * Returns true if the session is good, false if the user was signed out
   * (e.g. Admin SDK rejected the token) — caller must NOT call setLoading(false)
   * in that case because onAuthStateChanged(null) is already in flight.
   */
  const syncSession = useCallback(async (firebaseUser: User | null): Promise<boolean> => {
    try {
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken(/* forceRefresh */ false);
        const res = await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        if (!res.ok) {
          // Server rejected the token (Admin SDK not configured, token revoked
          // etc.). Sign out client-side so both sides agree: unauthenticated.
          // We return false so the caller skips setLoading(false) — the
          // resulting onAuthStateChanged(null) will set loading=false properly,
          // avoiding a flash where loading=false + isAuthenticated=true with
          // no cookie, which would restart the redirect loop.
          console.warn(`[Auth] Session sync failed (${res.status}) — signing out to stay in sync with server.`);
          await signOut(auth);
          return false;
        }
        return true;
      } else {
        await fetch('/api/auth/session', { method: 'DELETE' });
        return true;
      }
    } catch {
      // Network error — assume session is ok, let next interval retry.
      return true;
    }
  }, []);

  useEffect(() => {
    // Listen for authentication state changes
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      // syncSession FIRST — cookie must be written before loading clears.
      // If syncSession returns false it called signOut(); the resulting
      // onAuthStateChanged(null) will handle setLoading(false) and timer
      // cleanup, so we return early here to avoid a race where loading=false
      // briefly coexists with a non-null user but no cookie.
      if (firebaseUser) {
        const ok = await syncSession(firebaseUser);
        if (!ok) return;
      } else {
        await syncSession(null);
      }

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
