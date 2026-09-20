const CACHE_NAME = 'atlas-one-v10'
const APP_SHELL_CACHE = 'atlas-one-shell-v5'
const OFFLINE_URLS = ['/', '/clientes', '/orcamento', '/orcamento/novo', '/orcamento-rapido', '/assistencia']

function ehAssetLocal(pathname) {
  return pathname.startsWith('/_next/static/') ||
    pathname.startsWith('/icons/') ||
    /\.(?:js|css|woff2?|png|jpg|jpeg|webp|svg|ico)$/i.test(pathname)
}

async function cachearPaginaComDependencias(pathname, paginas, shell) {
  const resposta = await fetch(pathname, { cache: 'no-store' })
  if (!resposta.ok) return

  await paginas.put(pathname, resposta.clone())

  const html = await resposta.text()
  const urls = new Set()
  const regex = /(?:src|href)=["']([^"'#]+)["']/g
  let match
  while ((match = regex.exec(html))) {
    try {
      const url = new URL(match[1], self.location.origin)
      if (url.origin === self.location.origin && ehAssetLocal(url.pathname)) urls.add(url.href)
    } catch {}
  }

  await Promise.allSettled([...urls].map(async (url) => {
    const asset = await fetch(url, { cache: 'reload' })
    if (asset.ok) await shell.put(url, asset)
  }))
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const paginas = await caches.open(CACHE_NAME)
    const shell = await caches.open(APP_SHELL_CACHE)
    await Promise.allSettled(OFFLINE_URLS.map(path => cachearPaginaComDependencias(path, paginas, shell)))
  })())
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

          const pathname = url.pathname
          const porCaminho = await caches.match(pathname)
          if (porCaminho) return porCaminho

          // Rotas dinâmicas (Cliente 360, obra, medição etc.) podem não ter
          // sido visitadas antes. Entregamos o shell principal já instalado;
          // o código do App Router assume a rota atual no navegador.
          return (await caches.match('/')) || Response.error()
        })
    )
    return
  }

  if (ehAssetLocal(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached
        return fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone()
              caches.open(APP_SHELL_CACHE).then((cache) => cache.put(request, copy))
            }
            return response
          })
          .catch(() => Response.error())
      })
    )
  }
})
