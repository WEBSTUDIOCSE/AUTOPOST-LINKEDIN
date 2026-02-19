/**
 * Firebase Authentication Service
 * Handles all authentication-related operations
 */

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signOut,
  updateProfile,
  sendEmailVerification,
  updatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  deleteUser,
  type User,
  type UserCredential
} from 'firebase/auth';
import { doc, setDoc, getDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { firebaseHandler, firebaseVoidHandler, type ApiResponse } from '../handler';
import { IS_PRODUCTION } from '../config/environments';

/**
 * User data interface for our application
 */
export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  emailVerified: boolean;
  isAnonymous: boolean;
  createdAt: string;
  lastLoginAt: string;
  updatedAt: string;
  environment: 'UAT' | 'PROD';
  provider: string;
}

/**
 * Transform Firebase User to our AppUser interface
 */
function transformFirebaseUser(user: User, provider: string = 'email'): AppUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoURL: user.photoURL,
    emailVerified: user.emailVerified,
    isAnonymous: user.isAnonymous,
    createdAt: user.metadata.creationTime || new Date().toISOString(),
    lastLoginAt: user.metadata.lastSignInTime || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    environment: IS_PRODUCTION ? 'PROD' : 'UAT',
    provider
  };
}

/**
 * Save user data to Firestore
 */
async function saveUserToFirestore(user: User, provider: string = 'email'): Promise<void> {
  const userData = transformFirebaseUser(user, provider);
  await setDoc(doc(db, 'users', user.uid), {
    ...userData,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

/**
 * Firebase Authentication Service
 */
export const AuthService = {
  /**
   * Login with email and password
   */
  loginWithEmail: async (
    email: string, 
    password: string
  ): Promise<ApiResponse<AppUser>> => {
    return firebaseHandler(async () => {
      const userCredential: UserCredential = await signInWithEmailAndPassword(auth, email, password);
      
      // Update last login timestamp in Firestore
      await saveUserToFirestore(userCredential.user, 'email');
      
      return transformFirebaseUser(userCredential.user, 'email');
    }, 'auth/login-email');
  },

  /**
   * Register with email and password
   */
  registerWithEmail: async (
    email: string, 
    password: string, 
    displayName?: string
  ): Promise<ApiResponse<AppUser>> => {
    return firebaseHandler(async () => {
      // Create user account
      const userCredential: UserCredential = await createUserWithEmailAndPassword(auth, email, password);
      
      // Update display name if provided
      if (displayName) {
        await updateProfile(userCredential.user, { displayName });
      }
      
      // Send email verification
      await sendEmailVerification(userCredential.user);
      
      // Save user data to Firestore
      await saveUserToFirestore(userCredential.user, 'email');
      
      return transformFirebaseUser(userCredential.user, 'email');
    }, 'auth/register-email');
  },

  /**
   * Login with Google OAuth
   */
  loginWithGoogle: async (): Promise<ApiResponse<AppUser>> => {
    return firebaseHandler(async () => {
      const provider = new GoogleAuthProvider();
      provider.addScope('email');
      provider.addScope('profile');
      
      const userCredential: UserCredential = await signInWithPopup(auth, provider);
      
      // Save/update user data in Firestore
      await saveUserToFirestore(userCredential.user, 'google');
      
      return transformFirebaseUser(userCredential.user, 'google');
    }, 'auth/login-google');
  },

  /**
   * Send password reset email
   */
  resetPassword: async (email: string): Promise<ApiResponse<null>> => {
    return firebaseVoidHandler(async () => {
      await sendPasswordResetEmail(auth, email);
    }, 'auth/reset-password');
  },

  /**
   * Sign out current user
   */
  signOut: async (): Promise<ApiResponse<null>> => {
    return firebaseVoidHandler(async () => {
      await signOut(auth);
    }, 'auth/sign-out');
  },

  /**
   * Get current authenticated user
   */
  getCurrentUser: (): User | null => {
    return auth.currentUser;
  },

  /**
   * Get current user with Firestore data
   */
  getCurrentUserProfile: async (): Promise<ApiResponse<AppUser | null>> => {
    return firebaseHandler(async () => {
      const user = auth.currentUser;
      if (!user) return null;
      
      // Get additional user data from Firestore
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      
      if (userDoc.exists()) {
        return userDoc.data() as AppUser;
      } else {
        // If no Firestore data, create from auth user
        const userData = transformFirebaseUser(user);
        await saveUserToFirestore(user);
        return userData;
      }
    }, 'auth/get-current-user-profile');
  },

  /**
   * Update user profile
   */
  updateUserProfile: async (
    displayName?: string, 
    photoURL?: string
  ): Promise<ApiResponse<AppUser>> => {
    return firebaseHandler(async () => {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user found');
      }
      
      // Update Firebase Auth profile
      const profileData: { displayName?: string; photoURL?: string } = {};
      if (displayName !== undefined) profileData.displayName = displayName;
      if (photoURL !== undefined) profileData.photoURL = photoURL;
      
      if (Object.keys(profileData).length > 0) {
        await updateProfile(user, profileData);
      }
      
      // Update Firestore data
      await saveUserToFirestore(user);
      
      return transformFirebaseUser(user);
    }, 'auth/update-profile');
  },

  /**
   * Change user password
   */
  changePassword: async (
    currentPassword: string,
    newPassword: string
  ): Promise<ApiResponse<boolean>> => {
    return firebaseHandler(async () => {
      const user = auth.currentUser;
      if (!user || !user.email) {
        throw new Error('No authenticated user found');
      }

      // Re-authenticate user with current password
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);

      // Update password
      await updatePassword(user, newPassword);

      return true;
    }, 'auth/change-password');
  },

  /**
   * Delete user account
   */
  deleteAccount: async (password?: string): Promise<ApiResponse<boolean>> => {
    return firebaseHandler(async () => {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user found');
      }

      // For email/password users, require re-authentication
      if (user.providerData[0]?.providerId !== 'google.com' && password) {
        if (!user.email) {
          throw new Error('User email is required for re-authentication');
        }
        const credential = EmailAuthProvider.credential(user.email, password);
        await reauthenticateWithCredential(user, credential);
      }

      // For Google users, they need to re-authenticate with Google popup
      if (user.providerData[0]?.providerId === 'google.com') {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
      }

      // Delete user data from Firestore first
      try {
        const userDocRef = doc(db, IS_PRODUCTION ? 'prod_users' : 'uat_users', user.uid);
        await deleteDoc(userDocRef);
      } catch (firestoreError) {
        // Continue even if Firestore deletion fails
      }

      // Delete the user account
      await deleteUser(user);

      return true;
    }, 'auth/delete-account');
  }
};
