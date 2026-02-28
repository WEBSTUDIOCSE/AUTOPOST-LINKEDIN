/**
 * Firebase Messaging Service Worker
 *
 * Handles FCM push notifications when the app is in the background
 * or closed.  This file MUST live at the root of /public/ so it can
 * be registered with the correct scope.
 *
 * Firebase config is injected via query params at registration time
 * by the notification service.
 */

/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Parse Firebase config from query params (injected at registration time)
const params = new URLSearchParams(self.location.search);

firebase.initializeApp({
  apiKey: params.get('apiKey') || '',
  authDomain: params.get('authDomain') || '',
  projectId: params.get('projectId') || '',
  storageBucket: params.get('storageBucket') || '',
  messagingSenderId: params.get('messagingSenderId') || '',
  appId: params.get('appId') || '',
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
