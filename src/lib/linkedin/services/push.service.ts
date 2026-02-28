/**
 * Push Notification Service — Server-Side FCM Sending
 *
 * Sends push notifications to users via Firebase Cloud Messaging (Admin SDK).
 * Used by API routes (generate-all, publish-all, cutoff-all) and manual actions.
 *
 * This file is SERVER-ONLY — it uses firebase-admin.
 */

import 'server-only';
import { getAdminMessaging } from '@/lib/firebase/admin';
import { ProfileService } from './profile.service';
import type { NotificationType } from '../types';

// ── Types ────────────────────────────────────────────────────────────────────

interface PushPayload {
  type: NotificationType;
  title: string;
  body: string;
  postId?: string;
  clickAction?: string;
}

// ── Service ──────────────────────────────────────────────────────────────────

/**
 * Send a push notification to a user by looking up their stored FCM token.
 * Silently skips if the user has no token or if sending fails.
 */
export async function sendPushNotification(
  userId: string,
  payload: PushPayload,
): Promise<boolean> {
  try {
    const profileResult = await ProfileService.get(userId);
    const fcmToken = profileResult.data?.fcmToken;

    if (!fcmToken || fcmToken === 'enabled') {
      // No real token stored — skip silently
      return false;
    }

    return await sendPushToToken(fcmToken, payload);
  } catch (err) {
    console.error(`[Push] Failed to send notification to user ${userId}:`, err);
    return false;
  }
}

/**
 * Send a push notification directly to an FCM token.
 * Used when you already have the token (e.g. from a batch query).
 */
export async function sendPushToToken(
  fcmToken: string,
  payload: PushPayload,
): Promise<boolean> {
  try {
    const messaging = getAdminMessaging();

    await messaging.send({
      token: fcmToken,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: {
        type: payload.type,
        title: payload.title,
        body: payload.body,
        ...(payload.postId ? { postId: payload.postId } : {}),
        clickAction: payload.clickAction ?? '/posts',
      },
      webpush: {
        fcmOptions: {
          link: payload.clickAction ?? '/posts',
        },
        notification: {
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-72x72.png',
        },
      },
    });

    console.log(`[Push] Sent "${payload.type}" notification to token ${fcmToken.slice(0, 12)}...`);
    return true;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);

    // If the token is invalid/expired, clear it from the profile
    if (
      errMsg.includes('messaging/registration-token-not-registered') ||
      errMsg.includes('messaging/invalid-registration-token')
    ) {
      console.warn(`[Push] Token expired/invalid — clearing. Error: ${errMsg}`);
      // We don't have userId here, so the caller should handle cleanup
    }

    console.error(`[Push] FCM send failed: ${errMsg}`);
    return false;
  }
}
