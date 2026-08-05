// Service Worker for Push Notifications with Workbox
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.0.0/workbox-sw.js');

const SW_VERSION = 'v29-nav-request-fix';
// Auto-activate new SW builds so installs leave waiting state. Clients reload
// on controllerchange / SW_ACTIVATED (see use-pwa-update + appVersion).
// Do NOT client.navigate() on activate — that races with location.replace
// (?__poscal_reload=…) and produces NetworkFirst crashes + error responses.
const MIGRATE_AUTO_ACTIVATE = true;
const isDev = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

// Conditional logging helper
const log = (...args) => isDev && console.log(`[SW]`, ...args);
const error = (...args) => console.error(`[SW]`, ...args); // Always log errors

log(`Loading service worker ${SW_VERSION}`);

// Precache assets injected by Workbox (build-time hashed files).
workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || []);

/**
 * Same-origin script/CSS only. The previous match hit *every* script/style
 * (including third-party) and StaleWhileRevalidate threw uncaught errors in
 * production when the revalidation network request failed or cache was empty
 * (classic `_handle @ StaleWhileRevalidate.js` console stack — never seen in
 * dev because SW is off unless VITE_ENABLE_SW=true).
 */
const isSameOriginStatic = ({ request, url }) => {
  if (url.origin !== self.location.origin) return false;
  if (url.pathname === '/sw.js') return false;
  // Hashed Vite assets are immutable + precached; let precache handle them.
  if (url.pathname.startsWith('/assets/')) return false;
  return request.destination === 'script' || request.destination === 'style';
};

const staticRuntimeStrategy = new workbox.strategies.StaleWhileRevalidate({
  cacheName: 'poscal-static-runtime',
  plugins: [
    new workbox.cacheableResponse.CacheableResponsePlugin({
      // Never cache opaque/error redirects as "script".
      statuses: [200],
    }),
    new workbox.expiration.ExpirationPlugin({
      maxEntries: 64,
      maxAgeSeconds: 7 * 24 * 60 * 60,
      purgeOnQuotaError: true,
    }),
  ],
});

workbox.routing.registerRoute(isSameOriginStatic, async ({ event, request }) => {
  try {
    return await staticRuntimeStrategy.handle({ event, request });
  } catch (err) {
    // SWR throws when both cache miss + network fail. Fall back to network
    // (or empty Response) so the page console isn't filled with Workbox stacks.
    log('static runtime strategy failed, network fallback', request.url, err);
    try {
      return await fetch(request);
    } catch {
      return new Response('', {
        status: 503,
        statusText: 'Service Unavailable',
        headers: { 'Content-Type': 'text/plain' },
      });
    }
  }
});

// Immutable hashed build assets: cache-first (no StaleWhileRevalidate noise).
const ASSETS_CACHE = 'poscal-assets-v28';
workbox.routing.registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin
    && url.pathname.startsWith('/assets/')
    && (request.destination === 'script' || request.destination === 'style' || request.destination === 'font'),
  new workbox.strategies.CacheFirst({
    cacheName: ASSETS_CACHE,
    plugins: [
      new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [200] }),
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 80,
        maxAgeSeconds: 30 * 24 * 60 * 60,
        purgeOnQuotaError: true,
      }),
    ],
  }),
);

const navigationStrategy = new workbox.strategies.NetworkFirst({
  cacheName: 'poscal-pages',
  networkTimeoutSeconds: 3,
  plugins: [
    new workbox.cacheableResponse.CacheableResponsePlugin({
      statuses: [200],
    }),
  ],
});

workbox.routing.registerRoute(
  ({ request, url }) => request.mode === 'navigate' && url.origin === self.location.origin,
  async ({ event, request }) => {
    // Workbox StrategyHandler requires `request` — `.handle({ event })` alone
    // throws: Cannot read properties of undefined (reading 'url') in getCacheKey.
    try {
      return await navigationStrategy.handle({ event, request });
    } catch (err) {
      log('navigation strategy failed, trying cached shell', request.url, err);
      const cachedIndex =
        (await caches.match(workbox.precaching.getCacheKeyForURL('/index.html')))
        || (await caches.match('/index.html'));
      if (cachedIndex) return cachedIndex;
      try {
        return await fetch(request);
      } catch {
        return new Response('Offline', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' },
        });
      }
    }
  }
);

// Last resort for unmatched failures — prefer a real shell over Response.error()
// (error responses surface as "FetchEvent … network error response" in Chrome).
workbox.routing.setCatchHandler(async ({ request }) => {
  if (request?.mode === 'navigate') {
    const cachedIndex =
      (await caches.match(workbox.precaching.getCacheKeyForURL('/index.html')))
      || (await caches.match('/index.html'));
    if (cachedIndex) return cachedIndex;
    try {
      return await fetch(request);
    } catch {
      return new Response('Offline', {
        status: 503,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
  }
  try {
    return await fetch(request);
  } catch {
    return new Response('', { status: 503, statusText: 'Service Unavailable' });
  }
});

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
          // Bump ASSETS_CACHE when strategy changes; drop prior asset caches only.
          if (
            key === 'poscal-pages'
            || key === 'poscal-static-runtime'
            || (key.startsWith('poscal-assets') && key !== ASSETS_CACHE)
          ) {
            log(`Deleting old cache ${key}`);
            return caches.delete(key);
          }
          return Promise.resolve(false);
        }),
      );

      await self.clients.claim();
      // Notify open tabs only. Never client.navigate() here — concurrent
      // location.replace with ?__poscal_reload races NetworkFirst and can show
      // "FetchEvent resulted in a network error response".
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
