// Service Worker for Push Notifications with Workbox
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

const SW_VERSION = 'v18-production';
const isDev = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

// Conditional logging helper
const log = (...args) => isDev && console.log(`[SW]`, ...args);
const error = (...args) => console.error(`[SW]`, ...args); // Always log errors

log(`Loading service worker ${SW_VERSION}`);

// Precache assets injected by Workbox
workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || []);

// Service Worker for Push Notifications
self.addEventListener('install', (event) => {
  log(`Installing ${SW_VERSION}...`);
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  log(`Activated ${SW_VERSION}`);
  event.waitUntil(
    clients.claim().then(() => {
      // Send version to all clients
      return clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'SW_LOG', message: `✅ Service Worker ${SW_VERSION} activated!`, logType: 'success' });
        });
      });
    })
  );
});

// Handle push events
self.addEventListener('push', (event) => {
  log('========================================');
  log('🔥 PUSH EVENT RECEIVED!', event);
  log('Has data:', !!event.data);
  log('========================================');
  
  // Send message to all clients (only in dev)
  const sendMessageToClients = (message, type = 'info') => {
    if (!isDev) return;
    self.clients.matchAll().then(clients => {
      log(`Sending message to ${clients.length} clients:`, message);
      clients.forEach(client => {
        client.postMessage({ type: 'SW_LOG', message, logType: type });
      });
    });
  };
  
  if (isDev) {
    sendMessageToClients('🔔 PUSH EVENT RECEIVED!', 'success');
    sendMessageToClients(`🔥 This is a real push from Apple/Google!`, 'success');
  }
  
  let data = {
    title: 'PosCal Notification',
    body: 'You have a new notification',
    icon: '/pwa-192x192.png',
    badge: '/favicon.png',
    tag: 'general',
    data: {}
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      log('Push data parsed:', parsed);
      if (isDev) sendMessageToClients(`📦 Data: ${JSON.stringify(parsed).substring(0, 100)}`, 'info');
      data = { ...data, ...parsed };
    } catch (e) {
      error('Error parsing push data:', e);
      const rawText = event.data.text();
      log('Raw push data:', rawText);
      if (isDev) {
        sendMessageToClients(`❌ Parse error: ${e.message}`, 'error');
        sendMessageToClients(`Raw: ${rawText.substring(0, 100)}`, 'info');
      }
    }
  } else {
    log('No data in push event');
    if (isDev) sendMessageToClients('⚠️ No data in push event', 'error');
  }

  log('Showing notification:', data.title);
  if (isDev) sendMessageToClients(`📢 Showing: ${data.title}`, 'info');
  
  const options = {
    body: data.body,
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/favicon.png',
    tag: data.tag || 'general',
    data: data.data,
    requireInteraction: true,
    vibrate: [200, 100, 200],
    actions: [
      { action: 'open', title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
      .then(() => {
        log('Notification shown successfully');
        if (isDev) sendMessageToClients('✅ Notification shown successfully!', 'success');
      })
      .catch(err => {
        error('Error showing notification:', err);
        if (isDev) sendMessageToClients(`❌ Error showing notification: ${err.message}`, 'error');
      })
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  log('Notification clicked:', event);
  event.notification.close();

  if (event.action === 'dismiss') {
    return;
  }

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            // Navigate to signals page if it's a signal notification
            if (event.notification.data?.type === 'signal') {
              client.navigate('/signals');
            }
            return client.focus();
          }
        }
        // Open new window
        const url = event.notification.data?.type === 'signal' ? '/signals' : '/';
        if (clients.openWindow) {
          return clients.openWindow(url);
        }
      })
  );
});

// Handle push subscription change - Critical for production!
self.addEventListener('pushsubscriptionchange', async (event) => {
  log('Push subscription changed:', event);
  
  // Re-subscribe with new subscription
  event.waitUntil(
    (async () => {
      try {
        const newSubscription = await event.currentTarget.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: 'BE7EfMew8pPJTxly2cBT7PxInN62M2HWPB0yB-bNGwUniu0b2ouoLbEmfiQjHu5vowBcW0caNzaWpwP9mBZ0CM0'
        });
        
        // Send new subscription to backend
        await fetch('/api/update-push-subscription', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            oldSubscription: event.oldSubscription?.toJSON(),
            newSubscription: newSubscription.toJSON()
          })
        });
        
        log('Push subscription renewed successfully');
      } catch (err) {
        // Always log errors in production for monitoring
        error('Failed to renew push subscription:', err);
      }
    })()
  );
});