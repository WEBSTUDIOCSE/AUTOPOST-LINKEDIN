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
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getStorage, type Storage } from 'firebase-admin/storage';
import { getMessaging, type Messaging } from 'firebase-admin/messaging';

/**
 * Named app — prevents hot-reload from picking up a stale default app
 * (e.g. from the old UAT project) that firebase-admin keeps in its global
 * registry between module reloads.
 */
const ADMIN_APP_NAME = 'linkedin-autoposter';

let _adminAuth: Auth | null = null;
let _adminDb: Firestore | null = null;
let _adminStorage: Storage | null = null;
let _adminMessaging: Messaging | null = null;

function getAdminApp(): App {
  // Load service account credentials
  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  let credential: ReturnType<typeof cert> | undefined;
  let projectId: string | undefined;

  if (serviceAccountKey) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed = JSON.parse(serviceAccountKey) as any;
      credential = cert(parsed);
      projectId = parsed.project_id as string | undefined;
    } catch {
      throw new Error(
        '[FirebaseAdmin] FIREBASE_SERVICE_ACCOUNT_KEY is set but contains invalid JSON. ' +
        'Ensure it is the full service account JSON object.',
      );
    }
  } else if (process.env.NODE_ENV !== 'production') {
    console.warn(
      '[FirebaseAdmin] ⚠️  FIREBASE_SERVICE_ACCOUNT_KEY is not set. ' +
      'The Admin SDK will attempt GCP Application Default Credentials, ' +
      'which WILL TIME OUT in local dev. ' +
      'Add your service account JSON to .env.local:\n' +
      '  FIREBASE_SERVICE_ACCOUNT_KEY=\'{...}\'\n' +
      'Download it from Firebase Console → Project Settings → Service Accounts.',
    );
  }

  // Reuse the named app if it already exists (normal server lifecycle or hot-reload).
  // Using a named app means we never accidentally pick up a stale default app
  // left in firebase-admin's global registry from a previous hot-reload cycle.
  const existingNamed = getApps().find(app => app.name === ADMIN_APP_NAME);
  if (existingNamed) return existingNamed;

  // First initialisation — create the named app.
  return initializeApp(
    {
      ...(credential ? { credential } : {}),
      ...(projectId ? { projectId } : {}),
    },
    ADMIN_APP_NAME,
  );
}

export function getAdminAuth(): Auth {
  if (_adminAuth) return _adminAuth;
  _adminAuth = getAuth(getAdminApp());
  return _adminAuth;
}

export function getAdminDb(): Firestore {
  if (_adminDb) return _adminDb;
  _adminDb = getFirestore(getAdminApp());
  return _adminDb;
}

export function getAdminStorage(): Storage {
  if (_adminStorage) return _adminStorage;
  _adminStorage = getStorage(getAdminApp());
  return _adminStorage;
}

export function getAdminMessaging(): Messaging {
  if (_adminMessaging) return _adminMessaging;
  _adminMessaging = getMessaging(getAdminApp());
  return _adminMessaging;
}
