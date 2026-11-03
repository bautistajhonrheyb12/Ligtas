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
