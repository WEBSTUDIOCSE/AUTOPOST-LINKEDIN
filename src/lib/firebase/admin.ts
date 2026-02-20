/**
 * Firebase Admin SDK — Server-Only Singleton
 *
 * Initializes the Firebase Admin SDK ONCE for the entire server process.
 * Used exclusively in server-side code (API routes, server components)
 * to verify Firebase ID tokens cryptographically.
 *
 * Requires ONE of:
 *   1. GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service account JSON file
 *   2. FIREBASE_SERVICE_ACCOUNT_KEY env var containing the JSON string
 *   3. Running on GCP (auto-discovers credentials)
 *
 * The projectId is always taken from the current environment config.
 */

import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';

// ─── Lazy Singleton ──────────────────────────────────────────────────────────

let _adminApp: App | null = null;
let _adminAuth: Auth | null = null;

function getAdminApp(): App {
  if (_adminApp) return _adminApp;

  // Avoid duplicate initialization (hot-reload in dev)
  const existing = getApps();
  if (existing.length > 0) {
    _adminApp = existing[0]!;
    return _adminApp;
  }

  // Try to load service account credentials
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (serviceAccountKey) {
    try {
      const parsed = JSON.parse(serviceAccountKey);
      _adminApp = initializeApp({
        credential: cert(parsed),
      });
    } catch {
      throw new Error(
        '[FirebaseAdmin] FIREBASE_SERVICE_ACCOUNT_KEY is set but contains invalid JSON. ' +
        'Ensure it is the full service account JSON object.',
      );
    }
  } else {
    // Fall back to GOOGLE_APPLICATION_CREDENTIALS or GCP auto-discovery
    _adminApp = initializeApp();
  }

  return _adminApp;
}

/**
 * Get the Firebase Admin Auth instance.
 * Safe to call from any server-side code.
 */
export function getAdminAuth(): Auth {
  if (_adminAuth) return _adminAuth;
  _adminAuth = getAuth(getAdminApp());
  return _adminAuth;
}
