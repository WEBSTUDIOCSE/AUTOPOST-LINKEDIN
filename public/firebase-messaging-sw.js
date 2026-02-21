/**
 * Firebase Messaging Service Worker
 *
 * Handles FCM push notifications when the app is in the background
 * or closed.  This file MUST live at the root of /public/ so it can
 * be registered with the correct scope.
 *
 * In production, replace the firebaseConfig values below with your
 * actual config — or load them dynamically via query params at
 * registration time.
 */

/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Minimal config needed for the service worker (no auth, no Firestore)
// These values are safe to expose — they're already public in the client bundle.
firebase.initializeApp({
  apiKey: self.__FIREBASE_CONFIG__?.apiKey ?? '',
  authDomain: self.__FIREBASE_CONFIG__?.authDomain ?? '',
  projectId: self.__FIREBASE_CONFIG__?.projectId ?? '',
  storageBucket: self.__FIREBASE_CONFIG__?.storageBucket ?? '',
  messagingSenderId: self.__FIREBASE_CONFIG__?.messagingSenderId ?? '',
  appId: self.__FIREBASE_CONFIG__?.appId ?? '',
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage(function (payload) {
  const data = payload.data || {};
  const notificationTitle = payload.notification?.title || data.title || 'LinkedIn Autoposter';
  const notificationOptions = {
    body: payload.notification?.body || data.body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    data: {
      postId: data.postId,
      clickAction: data.clickAction || '/dashboard',
    },
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click — open the relevant page
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const clickAction = event.notification.data?.clickAction || '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // Focus an existing tab if one is open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(clickAction);
          return client.focus();
        }
      }
      // Otherwise open a new window
      return clients.openWindow(clickAction);
    }),
  );
});
