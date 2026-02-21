/**
 * FCM Notification Service
 *
 * Handles push notifications via Firebase Cloud Messaging (FCM).
 * Two halves:
 *   1. Client-side: request permission, get token, listen for messages
 *   2. Server-side: send notifications (used by Firebase Functions)
 *
 * This file contains the CLIENT-SIDE helpers that run in the browser.
 * Server-side sending lives in the Firebase Functions project.
 */

import { getMessaging, getToken, onMessage, type MessagePayload } from 'firebase/messaging';
import { app } from '@/lib/firebase/firebase';
import { getCurrentFirebaseConfig } from '@/lib/firebase/config/environments';
import type { NotificationPayload } from '../types';

// ═══════════════════════════════════════════════════════════════════════════════
// TOKEN MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Request notification permission and return the FCM device token.
 *
 * Flow:
 * 1. Browser asks user "Allow notifications?"
 * 2. If granted, FCM registers a service worker and returns a device token
 * 3. Store this token in Firestore via ProfileService.setFcmToken()
 *
 * @returns The FCM token string, or null if permission was denied.
 */
export async function requestNotificationPermission(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[FCM] Notification permission denied');
      return null;
    }

    const messaging = getMessaging(app);
    const vapidKey = getCurrentFirebaseConfig().vapidKey;

    if (!vapidKey) {
      console.error('[FCM] VAPID key is not configured');
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: await navigator.serviceWorker.register('/firebase-messaging-sw.js'),
    });

    return token;
  } catch (error) {
    console.error('[FCM] Failed to get token:', error);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FOREGROUND MESSAGE LISTENER
// ═══════════════════════════════════════════════════════════════════════════════

export type NotificationHandler = (payload: NotificationPayload) => void;

/**
 * Listen for FCM messages when the app is in the foreground.
 *
 * Background messages are handled automatically by the service worker
 * registered in `public/firebase-messaging-sw.js`.
 *
 * @returns An unsubscribe function.
 */
export function onForegroundMessage(handler: NotificationHandler): () => void {
  if (typeof window === 'undefined') return () => {};

  const messaging = getMessaging(app);

  return onMessage(messaging, (payload: MessagePayload) => {
    // Map FCM payload to our NotificationPayload shape
    const data = payload.data as Record<string, string> | undefined;
    if (!data) return;

    handler({
      type: data.type as NotificationPayload['type'],
      title: payload.notification?.title ?? data.title ?? '',
      body: payload.notification?.body ?? data.body ?? '',
      postId: data.postId,
      clickAction: data.clickAction,
    });
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION DISPLAY (in-app toast helper)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Show a browser Notification if the page is active.
 * For in-app UI toasts, use a state-based approach in your React component
 * rather than this function.
 */
export function showBrowserNotification(n: NotificationPayload): void {
  if (typeof window === 'undefined' || Notification.permission !== 'granted') return;

  const notification = new Notification(n.title, {
    body: n.body,
    icon: '/icons/icon-192x192.png',
    data: { postId: n.postId, clickAction: n.clickAction },
  });

  notification.onclick = () => {
    if (n.clickAction) {
      window.open(n.clickAction, '_self');
    }
    notification.close();
  };
}
