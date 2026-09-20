const CACHE_NAME = 'atlas-one-v7'
const APP_SHELL_CACHE = 'atlas-one-shell-v2'
const OFFLINE_URLS = ['/', '/orcamento', '/orcamento/novo', '/orcamento/rapido', '/assistencia']

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS)),
      caches.open(APP_SHELL_CACHE),
    ])
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME && key !== APP_SHELL_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return
  if (url.pathname === '/sw.js') return

  // O App Router do Next usa requisições RSC/Flight ao navegar por <Link>.
  // Offline, uma resposta HTML cacheada para esse fetch quebra o parser do cliente
  // e causa "Application error: a client-side exception has occurred".
  // Forçamos navegação de documento quando não há rede; assim o service worker
  // entrega o HTML correto da rota e o app hidrata com os chunks já cacheados.
  const ehRsc = request.headers.get('RSC') === '1' || url.searchParams.has('_rsc')
  if (ehRsc) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response('', {
          status: 503,
          statusText: 'Offline',
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      )
    )
    return
  }

  // Navegação: tenta rede primeiro e usa a página previamente instalada se estiver offline.
  if (request.mode === 'navigate') {
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
          const pathname = new URL(request.url).pathname
          const porCaminho = await caches.match(pathname)
          if (porCaminho) return porCaminho
          const fallback = await caches.match('/orcamento-rapido')
          return fallback || (await caches.match('/')) || Response.error()
        })
    )
    return
  }

  // Para o Atlas abrir do zero sem internet, os chunks JS/CSS/fontes/imagens do
  // app shell também precisam estar disponíveis. Cache-first para recursos locais,
  // preenchendo o cache enquanto o usuário usa o sistema online.
  const ehShell =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(?:js|css|woff2?|png|jpg|jpeg|webp|svg|ico)$/i.test(url.pathname)

  if (ehShell) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request).then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(APP_SHELL_CACHE).then((cache) => cache.put(request, copy))
          }
          return response
        })
      })
    )
  }
})
