// LIGTAS service worker: keeps the app shell and recently viewed map tiles
// available offline. Live data (alerts, centers, reports) is cached by the app
// itself in localStorage, so Supabase requests always go to the network here.
const SHELL_CACHE = 'ligtas-shell-v1'
const TILE_CACHE = 'ligtas-tiles-v1'
const MAX_TILES = 400
const SHELL_FILES = ['/', '/manifest.webmanifest', '/LigtasLogo.png', '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => ![SHELL_CACHE, TILE_CACHE].includes(key)).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

async function trimCache(name, maxEntries) {
  const cache = await caches.open(name)
  const keys = await cache.keys()
  await Promise.all(keys.slice(0, Math.max(keys.length - maxEntries, 0)).map((key) => cache.delete(key)))
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  // Page loads: try the network first so updates arrive, fall back to the cached shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(SHELL_CACHE).then((cache) => cache.put('/', copy))
          return response
        })
        .catch(() => caches.match('/')),
    )
    return
  }

  // Map tiles: serve the saved copy instantly and refresh it in the background.
  if (url.hostname.endsWith('tile.openstreetmap.org')) {
    event.respondWith(
      caches.open(TILE_CACHE).then(async (cache) => {
        const cached = await cache.match(request)
        const network = fetch(request)
          .then((response) => {
            cache.put(request, response.clone()).then(() => trimCache(TILE_CACHE, MAX_TILES))
            return response
          })
          .catch(() => cached)
        return cached ?? network
      }),
    )
    return
  }

  // Built assets have hashed names, so a cached copy never goes stale.
  if (url.origin === self.location.origin && (url.pathname.startsWith('/assets/') || SHELL_FILES.includes(url.pathname) || /\.(png|svg|webp)$/.test(url.pathname))) {
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy))
        }
        return response
      })),
    )
  }
})

// ---------------------------------------------------------------------------
// Push notifications (sent by the send-push server function). They arrive even
// when LIGTAS is closed; the message is encrypted so only this phone can read it.
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }
  const urgent = Boolean(data.urgent)
  event.waitUntil(self.registration.showNotification(data.title || 'LIGTAS', {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/badge-96.png',
    tag: data.tag || undefined,
    // A newer update about the same report replaces the older one, and still alerts.
    renotify: Boolean(data.tag),
    // SOS calls and high alerts stay on screen until they are tapped.
    requireInteraction: urgent,
    vibrate: urgent ? [300, 120, 300, 120, 300] : [200],
    timestamp: data.at || Date.now(),
    data: { url: data.url || '/' },
  }))
})

// Tapping a notification opens LIGTAS, or brings it forward if it is open.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/', self.location.origin).href
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
    const open = windows.find((client) => client.url.startsWith(self.location.origin))
    if (open) return open.focus()
    return self.clients.openWindow(target)
  }))
})
