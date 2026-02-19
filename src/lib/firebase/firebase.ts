/**
 * Firebase App Initialization
 * Uses environment configuration for UAT/PROD switching
 */

import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getCurrentFirebaseConfig, verifyEnvironmentConfiguration } from './config/environments';

// Verify environment configuration on initialization
if (process.env.NODE_ENV === 'development') {
  verifyEnvironmentConfiguration();
}

// Initialize Firebase app with current environment config
export const app: FirebaseApp = initializeApp(getCurrentFirebaseConfig());

// Initialize Firebase services
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);

// Export for service access
export { app as firebaseApp };
