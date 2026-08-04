// Service Worker for Push Notifications with Workbox
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

const SW_VERSION = 'v26-safe-reload';
// Auto-activate new SW builds so installs leave waiting state. Clients reload
// only after an in-app "Update now" (see use-pwa-update) — do not client.navigate here.
const MIGRATE_AUTO_ACTIVATE = true;
const isDev = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

// Conditional logging helper
const log = (...args) => isDev && console.log(`[SW]`, ...args);
const error = (...args) => console.error(`[SW]`, ...args); // Always log errors

log(`Loading service worker ${SW_VERSION}`);

// Precache assets injected by Workbox
workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || []);

// Never serve a stale HTML shell when a fresh network version exists.
workbox.routing.registerRoute(
  ({ request }) => request.destination === 'script' || request.destination === 'style',
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: 'poscal-static-runtime',
  })
);

const navigationStrategy = new workbox.strategies.NetworkFirst({
  cacheName: 'poscal-pages',
  networkTimeoutSeconds: 3,
  plugins: [
    new workbox.cacheableResponse.CacheableResponsePlugin({
      statuses: [0, 200],
    }),
  ],
});

workbox.routing.registerRoute(
  ({ request, url }) => request.mode === 'navigate' && url.origin === self.location.origin,
  async ({ event }) => {
    try {
      return await navigationStrategy.handle({ event });
    } catch (err) {
      const cachedIndex = await caches.match(workbox.precaching.getCacheKeyForURL('/index.html'));
      if (cachedIndex) return cachedIndex;
      throw err;
    }
  }
);

self.addEventListener('install', (event) => {
  log(`Installing ${SW_VERSION}...`);
  if (MIGRATE_AUTO_ACTIVATE) {
    self.skipWaiting();
  }
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  log(`Activated ${SW_VERSION}`);
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map((key) => {
          // Workbox manages its own precache revision list. Clear stale page /
          // runtime caches so the next load is not stuck on an old shell.
          if (key === 'poscal-pages' || key === 'poscal-static-runtime') {
            log(`Deleting old cache ${key}`);
            return caches.delete(key);
          }
          return Promise.resolve(false);
        }),
      );

      await self.clients.claim();
      // Notify open tabs so the in-app banner can appear. Do NOT client.navigate —
      // that races with location.reload/replace and causes ERR_FAILED in Chrome.
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      await Promise.all(
        allClients.map((client) => {
          client.postMessage({ type: 'SW_ACTIVATED', version: SW_VERSION });
          return undefined;
        }),
      );
    })()
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
    data: {
      ...(data.data || {}),
      url: data.url || data.data?.url || (data.data?.type === 'news' ? '/calendar' : data.data?.type === 'signal' ? '/calendar' : '/'),
    },
    requireInteraction: true,
    renotify: true,
    timestamp: Date.now(),
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

  event.waitUntil(
    Promise.resolve()
      .then(() => {
        const target = event.notification.data?.url || '/';
        const url = new URL(target, self.location.origin);
        if (url.origin !== self.location.origin) return '/';
        return `${url.pathname}${url.search}${url.hash}`;
      })
      .catch(() => '/')
      .then((targetUrl) => clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            const currentUrl = new URL(client.url);
            const currentPath = `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`;
            if ('navigate' in client && currentPath !== targetUrl) {
              return client.navigate(targetUrl).then((navigatedClient) => {
                return (navigatedClient || client).focus();
              });
            }
            return client.focus();
          }
        }

        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      }))
  );
});
