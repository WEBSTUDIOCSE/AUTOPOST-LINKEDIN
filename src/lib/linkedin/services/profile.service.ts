/**
 * Autoposter Profile Service — user preferences, LinkedIn tokens, schedule
 *
 * Each Firebase auth user has one autoposter profile that stores:
 * - LinkedIn OAuth tokens
 * - FCM token for push notifications
 * - Posting schedule (which days, what times)
 * - AI persona (writing style description)
 */

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/firebase';
import { firebaseHandler, firebaseVoidHandler } from '@/lib/firebase/handler';
import { PROFILES_COLLECTION } from '../collections';
import type { AutoposterProfile, PostingSchedule } from '../types';

// ── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_SCHEDULE: PostingSchedule = {
  monday: { enabled: false, postTime: '10:00' },
  tuesday: { enabled: true, postTime: '10:00' },
  wednesday: { enabled: true, postTime: '09:00' },
  thursday: { enabled: true, postTime: '10:00' },
  friday: { enabled: false, postTime: '10:00' },
  saturday: { enabled: false, postTime: '10:00' },
  sunday: { enabled: false, postTime: '10:00' },
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function toProfile(data: Record<string, unknown>): AutoposterProfile {
  return {
    ...data,
    linkedinTokenExpiry: (data.linkedinTokenExpiry as Timestamp)?.toDate?.() ?? undefined,
    createdAt: (data.createdAt as Timestamp)?.toDate?.() ?? new Date(),
    updatedAt: (data.updatedAt as Timestamp)?.toDate?.() ?? new Date(),
  } as AutoposterProfile;
}

// ── Service ──────────────────────────────────────────────────────────────────

export const ProfileService = {
  /**
   * Get the autoposter profile for a user.
   * Returns null if it doesn't exist yet.
   */
  get(userId: string) {
    return firebaseHandler(async () => {
      const snap = await getDoc(doc(db, PROFILES_COLLECTION, userId));
      if (!snap.exists()) return null;
      return toProfile(snap.data());
    }, 'ProfileService.get');
  },

  /**
   * Create or fully replace the user's autoposter profile.
   * Called the first time the user enters the autoposter setup.
   */
  create(userId: string, data?: Partial<AutoposterProfile>) {
    return firebaseVoidHandler(async () => {
      await setDoc(doc(db, PROFILES_COLLECTION, userId), {
        userId,
        linkedinAccessToken: null,
        linkedinRefreshToken: null,
        linkedinTokenExpiry: null,
        linkedinMemberUrn: null,
        linkedinConnected: false,
        fcmToken: null,
        persona: null,
        postingSchedule: DEFAULT_SCHEDULE,
        timezone: 'Asia/Kolkata',
        draftGenerationHour: 21,
        reviewDeadlineHour: 3,
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }, 'ProfileService.create');
  },

  /** Update specific fields on the profile */
  update(userId: string, data: Partial<Omit<AutoposterProfile, 'userId' | 'createdAt'>>) {
    return firebaseVoidHandler(async () => {
      await updateDoc(doc(db, PROFILES_COLLECTION, userId), {
        ...data,
        updatedAt: serverTimestamp(),
      });
    }, 'ProfileService.update');
  },

  // ── LinkedIn token management ────────────────────────────────────────────

  /** Store LinkedIn OAuth tokens after a successful callback */
  setLinkedInTokens(userId: string, tokens: {
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
    memberUrn: string;
  }) {
    return firebaseVoidHandler(async () => {
      await updateDoc(doc(db, PROFILES_COLLECTION, userId), {
        linkedinAccessToken: tokens.accessToken,
        linkedinRefreshToken: tokens.refreshToken ?? null,
        linkedinTokenExpiry: new Date(Date.now() + tokens.expiresIn * 1000),
        linkedinMemberUrn: tokens.memberUrn,
        linkedinConnected: true,
        updatedAt: serverTimestamp(),
      });
    }, 'ProfileService.setLinkedInTokens');
  },

  /** Clear LinkedIn connection */
  disconnectLinkedIn(userId: string) {
    return firebaseVoidHandler(async () => {
      await updateDoc(doc(db, PROFILES_COLLECTION, userId), {
        linkedinAccessToken: null,
        linkedinRefreshToken: null,
        linkedinTokenExpiry: null,
        linkedinMemberUrn: null,
        linkedinConnected: false,
        updatedAt: serverTimestamp(),
      });
    }, 'ProfileService.disconnectLinkedIn');
  },

  // ── FCM token ────────────────────────────────────────────────────────────

  /** Update the FCM device token (called after requestPermission) */
  setFcmToken(userId: string, fcmToken: string) {
    return firebaseVoidHandler(async () => {
      await updateDoc(doc(db, PROFILES_COLLECTION, userId), {
        fcmToken,
        updatedAt: serverTimestamp(),
      });
    }, 'ProfileService.setFcmToken');
  },

  // ── Schedule ─────────────────────────────────────────────────────────────

  /** Update the posting schedule */
  updateSchedule(userId: string, schedule: PostingSchedule) {
    return firebaseVoidHandler(async () => {
      await updateDoc(doc(db, PROFILES_COLLECTION, userId), {
        postingSchedule: schedule,
        updatedAt: serverTimestamp(),
      });
    }, 'ProfileService.updateSchedule');
  },

  // ── Persona ──────────────────────────────────────────────────────────────

  /** Update the AI writing persona */
  updatePersona(userId: string, persona: string) {
    return firebaseVoidHandler(async () => {
      await updateDoc(doc(db, PROFILES_COLLECTION, userId), {
        persona,
        updatedAt: serverTimestamp(),
      });
    }, 'ProfileService.updatePersona');
  },
};
