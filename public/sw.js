const CACHE_NAME = 'atlas-one-v3'
const OFFLINE_URLS = ['/', '/orcamento-rapido', '/assistencia']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  )
  self.clients.claim()
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

// O Atlas é um ERP: dados de API nunca devem ir para Cache Storage.
// Também deixamos assets versionados do Next.js sob responsabilidade do navegador/CDN.
// O service worker existe apenas para dar fallback offline às navegações HTML.
self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return
  if (url.pathname.startsWith('/_next/')) return
  if (url.pathname.startsWith('/icons/')) return
  if (url.pathname === '/manifest.json' || url.pathname === '/sw.js') return
  if (request.mode !== 'navigate') return

  event.respondWith(
    fetch(new Request(request, { cache: 'no-store' }))
      .then((response) => {
        if (response.ok) {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
        }
        return response
      })
      .catch(async () => {
        const exact = await caches.match(request)
        if (exact) return exact
        const fallback = await caches.match('/')
        return fallback || Response.error()
      })
  )
})
