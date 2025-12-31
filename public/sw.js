// Service Worker for Push Notifications with Workbox
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

const SW_VERSION = 'v14-push-debug';
console.log(`[SW] Loading service worker ${SW_VERSION}`);

// Precache assets injected by Workbox
workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || []);

// Service Worker for Push Notifications
self.addEventListener('install', (event) => {
  console.log(`[SW] Installing ${SW_VERSION}...`);
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log(`[SW] Activated ${SW_VERSION}`);
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
  console.log('========================================');
  console.log('[SW] 🔥 PUSH EVENT RECEIVED!', event);
  console.log('[SW] Has data:', !!event.data);
  console.log('========================================');
  
  // Send message to all clients
  const sendMessageToClients = (message, type = 'info') => {
    self.clients.matchAll().then(clients => {
      console.log(`[SW] Sending message to ${clients.length} clients:`, message);
      clients.forEach(client => {
        client.postMessage({ type: 'SW_LOG', message, logType: type });
      });
    });
  };
  
  sendMessageToClients('🔔 PUSH EVENT RECEIVED!', 'success');
  sendMessageToClients(`🔥 This is a real push from Apple/Google!`, 'success');
  
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
      console.log('[SW] Push data parsed:', parsed);
      sendMessageToClients(`📦 Data: ${JSON.stringify(parsed).substring(0, 100)}`, 'info');
      data = { ...data, ...parsed };
    } catch (e) {
      console.error('[SW] Error parsing push data:', e);
      const rawText = event.data.text();
      console.log('[SW] Raw push data:', rawText);
      sendMessageToClients(`❌ Parse error: ${e.message}`, 'error');
      sendMessageToClients(`Raw: ${rawText.substring(0, 100)}`, 'info');
    }
  } else {
    console.log('[SW] No data in push event');
    sendMessageToClients('⚠️ No data in push event', 'error');
  }

  console.log('[SW] Showing notification:', data.title);
  sendMessageToClients(`📢 Showing: ${data.title}`, 'info');
  
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
        console.log('[SW] Notification shown successfully');
        sendMessageToClients('✅ Notification shown successfully!', 'success');
      })
      .catch(err => {
        console.error('[SW] Error showing notification:', err);
        sendMessageToClients(`❌ Error showing notification: ${err.message}`, 'error');
      })
  );
});

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  const isDev = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';
  if (isDev) console.log('Notification clicked:', event);
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
  const isDev = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';
  if (isDev) console.log('Push subscription changed:', event);
  
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
        
        if (isDev) console.log('Push subscription renewed successfully');
      } catch (error) {
        // Always log errors in production for monitoring
        console.error('Failed to renew push subscription:', error);
      }
    })()
  );
});