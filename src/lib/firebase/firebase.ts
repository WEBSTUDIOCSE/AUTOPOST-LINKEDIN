/**
 * Firebase App Initialization
 * Uses environment configuration for UAT/PROD switching
 */

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';
import { getCurrentFirebaseConfig, verifyEnvironmentConfiguration } from './config/environments';

// Verify environment configuration on initialization
if (process.env.NODE_ENV === 'development') {
  verifyEnvironmentConfiguration();
}

// Initialize Firebase app with current environment config
export const app: FirebaseApp = initializeApp(getCurrentFirebaseConfig());

// ── Firebase App Check ────────────────────────────────────────────────────────
// App Check prevents unauthorized apps / bots from calling Firebase services
// directly with the public client config. reCAPTCHA Enterprise is the
// recommended provider for web apps.
//
// Required env var: NEXT_PUBLIC_RECAPTCHA_SITE_KEY
// Set up at: https://console.cloud.google.com/security/recaptcha
// Then enable App Check enforcement in: https://console.firebase.google.com
if (typeof window !== 'undefined') {
  const recaptchaKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  if (recaptchaKey) {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(recaptchaKey),
      // Automatically refresh App Check tokens before they expire
      isTokenAutoRefreshEnabled: true,
    });
  } else if (process.env.NODE_ENV === 'development') {
    // In dev without reCAPTCHA, enable the debug token provider.
    // Set self.FIREBASE_APPCHECK_DEBUG_TOKEN = true in the browser console
    // to get a debug token, then register it in the Firebase console.
    console.warn(
      '[Firebase] App Check is disabled — NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not set. ' +
      'See https://firebase.google.com/docs/app-check/web/recaptcha-enterprise-provider',
    );
  }
}

// Initialize Firebase services
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

// Export for service access
export { app as firebaseApp };
