// Service worker mínimo: deja la app instalable y abre sin conexión.
// Las notificaciones push (etapa 3) se agregan en este mismo archivo.
const CACHE = 'haxmatch-v1'

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.add('/')).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return
  // Navegación: primero la red, y si no hay conexión, la app guardada.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/')))
    return
  }
  // Archivos de la app (tienen hash en el nombre): caché primero.
  e.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) {
        const copia = res.clone()
        caches.open(CACHE).then((c) => c.put(req, copia))
      }
      return res
    })),
  )
})
